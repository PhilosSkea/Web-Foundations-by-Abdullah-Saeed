# Production-Grade Secure Backend Architecture

## Overview

This backend implements security-first design patterns for a subscription-based article service. **The backend is the single source of truth** for all security-critical decisions.

---

## Core Security Principles

### 1. **Trust Boundary: Backend Only** 🔒

```
❌ Never trust:                ✅ Always verify with:
- Frontend calculations        - Backend logic
- Client-sent prices          - Database queries
- localStorage tokens         - Server-side sessions
- Browser validations         - Cryptographic verification
```

### 2. **Defense in Depth**

Every security decision has multiple layers:

```
Layer 1: Input Validation
Layer 2: Authentication (session cookies)
Layer 3: Authorization (subscription checks)
Layer 4: Business Logic (plans defined server-side)
Layer 5: Audit Logging (all actions recorded)
```

---

## Authentication Flow

### Current Implementation: Session Cookies ✅

```
User Input (email/password)
    ↓
[Backend Auth Endpoint]
    ↓
bcrypt verify password
    ↓
✅ Create httpOnly session cookie
    ↓
Store session in server memory
    ↓
Cookie auto-sent on next request (browser handles)
    ↓
No JavaScript access (httpOnly = safe from XSS)
```

**Why NOT JWT in localStorage?**

```
❌ localStorage auth flow:
User → Frontend stores JWT in localStorage
       → JavaScript sends in headers
       → XSS attack steals token
       → Attacker has full access forever

✅ httpOnly cookie flow:
User → Backend creates session
       → httpOnly cookie (cannot be read by JS)
       → Browser auto-sends cookie
       → XSS cannot steal it
       → Session expires after 24h
```

### Password Hashing

```javascript
// Backend uses bcrypt (never send plaintext)
const hash = await bcrypt.hash(password, 10);
// 10 rounds = ~100ms per attempt (blocks brute force)
```

---

## Payment Flow - The Trust Boundary Challenge

**Problem:** User has access to network requests. They could:
- Intercept payment and claim success without paying
- Modify payment amount client-side
- Forge completion messages

**Solution:** Stripe Webhooks (server-to-server communication)

```
┌─────────────────────────────────────────────────────────────┐
│ TRUST BOUNDARY: Client ↔ Server                             │
└─────────────────────────────────────────────────────────────┘

Frontend (Untrusted):
  1. User selects plan (displayed from /api/payment/plans)
  2. Frontend calls /api/payment/create-checkout
  3. Backend creates Payment Intent with BACKEND-CALCULATED price
  4. Frontend receives clientSecret only
  5. Stripe.js handles card input (directly to Stripe, not us)
  6. User completes payment in Stripe modal
  7. Stripe processes payment securely
  8. Frontend sees "pending" status ⏳

Backend (Trusted - Webhooks):
  1. Stripe confirms payment with webhook signature
  2. We verify signature (STRIPE_WEBHOOK_SECRET)
  3. We verify amount matches our plan price
  4. Only THEN create subscription
  5. User gets access
```

### Critical: Subscription Created Only After Webhook

```javascript
// ❌ INSECURE (old code)
router.post('/confirm-payment', (req, res) => {
  db.savePayment(req.body); // TRUST EVERYTHING
  res.json({ success: true });
  // ATTACKER CAN FAKE THIS
});

// ✅ SECURE (new code)
async function handlePaymentSucceeded(intent) {
  // Webhook signature already verified by Stripe
  
  // Verify amount matches plan
  if (!validatePlanPrice(planId, amount)) {
    return; // Fraud detected
  }
  
  // ONLY NOW create subscription
  await db.subscriptions.create(...);
}
```

---

## Plans Configuration

### Backend is Single Source of Truth

```javascript
// /backend/config/plans.js

export const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 9800, // $98.00 in cents
    articles_limit: 10,
    features: [...]
  }
};

// Frontend requests plans:
GET /api/payment/plans
↓
Returns ONLY:
- id, name, price, features, duration_days
- Never sends the actual price that will be charged

// When creating payment:
POST /api/payment/create-checkout
{
  "planId": "starter"
  // Price is NOT sent from frontend
}
↓
Backend looks up price from config
↓
Backend enforces: price = SUBSCRIPTION_PLANS[planId].price
```

### Frontend Cannot Modify Prices

```javascript
// ❌ INSECURE
fetch('/api/payment/create-checkout', {
  body: JSON.stringify({
    planId: 'starter',
    amount: 1 // ATTACKER SENDS $0.01
  })
});

// ✅ SECURE (our implementation)
fetch('/api/payment/create-checkout', {
  body: JSON.stringify({
    planId: 'starter'
    // Price ignored - backend calculates it
  })
});
```

---

## Protected PDF Serving

### Issue: PDFs in Public Folder

```
❌ /pdfs/article.pdf
   ↓
   Anyone can download: http://example.com/pdfs/article.pdf
   No authentication needed
```

### Solution: Backend-Controlled Access

```
✅ /api/articles/download/article.pdf
   ↓
   [Authentication Check]
   ├─ Is user logged in? (session cookie)
   └─ No → 401 Unauthorized

   [Subscription Check]
   ├─ Does user have active subscription?
   └─ No → 403 Forbidden

   [Path Validation]
   ├─ Is filename in whitelist? (prevent ../../../etc/passwd)
   └─ No → 404 Not Found

   [Audit Logging]
   ├─ Log who downloaded what and when
   └─ Detect suspicious patterns

   [Stream File]
   └─ Send PDF with no-cache headers
```

### Whitelist Prevents Path Traversal

```javascript
// Only these files can be downloaded
const ALLOWED_FILES = new Map([
  ['health-wellness.pdf', 'Health and Wellness Guide'],
  ['article-1.pdf', 'Article 1']
]);

// ❌ Attacker tries: /api/articles/download/../../../../etc/passwd
// ✅ Blocked: filename not in ALLOWED_FILES
```

---

## Idempotency: Preventing Duplicate Charges

### Problem: Network Failures

```
User clicks "Pay" → Network fails → Browser retries
                 ↓
            Backend receives request twice
                 ↓
            Charges user twice
```

### Solution: Idempotency Keys

```javascript
// Request 1 (original)
POST /api/payment/create-checkout
Header: Idempotency-Key: "user-123-starter-1234567890"
↓
Backend creates Payment Intent with this key
Stripe remembers: this key = this payment

// Request 2 (retry, same key)
POST /api/payment/create-checkout
Header: Idempotency-Key: "user-123-starter-1234567890"
↓
Stripe: "Oh, I've seen this key before!"
↓
Returns same Payment Intent (no new charge)
```

---

## Rate Limiting: Blocking Brute Force

### Auth Endpoints Protected

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // Only 5 attempts per 15 minutes
});

// After 5 failed logins in 15 min:
// 429 Too Many Requests
// Browser: "Try again later"
```

### Prevents

- Brute force password attacks
- Credential stuffing (using leaked passwords)
- Enumeration (checking if email exists)

---

## Audit Logging

### Everything Important is Logged

```javascript
await db.audit.log(userId, 'login', {
  email: 'user@example.com',
  ip: '192.168.1.1'
});

await db.audit.log(userId, 'subscription_created', {
  planId: 'starter',
  amount: 9800,
  expiresAt: '2025-01-21'
});

await db.audit.log(userId, 'pdf_download', {
  filename: 'article.pdf',
  fileSize: 2300000,
  ip: '192.168.1.1'
});

await db.audit.log(userId, 'payment_failed', {
  paymentIntentId: 'pi_xxx',
  reason: 'card_declined'
});
```

### Use Cases

1. **Fraud Detection**: Sudden spike in downloads
2. **Compliance**: "Who accessed what?"
3. **Support**: "What happened with this user?"
4. **Security**: Detect attacks (many failed logins from same IP)

---

## Endpoint Security Summary

| Endpoint | Auth | Logic |
|----------|------|-------|
| POST /auth/signup | No | Validate email/password, hash, create user |
| POST /auth/login | No | Verify password, create session |
| POST /auth/logout | ✅ | Destroy session |
| GET /payment/plans | No | Public: return plans (backend truth) |
| POST /payment/create-checkout | ✅ | Verify subscription, create intent, use backend price |
| GET /articles/public | No | Show preview only |
| GET /articles/subscribed | ✅ + 📦 | Verify subscription, list articles |
| GET /articles/download/:file | ✅ + 📦 | Verify auth + subscription + whitelist, serve PDF |
| POST /webhooks/stripe | No* | Verify signature, update database, grant access |

\* Webhook requires Stripe signature verification (not user auth)

---

## Environment Variables (Must Keep Secret)

```bash
# Generate random 32+ char strings
SESSION_SECRET=...     # Session encryption
JWT_SECRET=...         # Unused now (remove later)

# From Stripe dashboard
STRIPE_SECRET_KEY=sk_test_...        # Charge cards
STRIPE_PUBLISHABLE_KEY=pk_test_...   # Frontend only
STRIPE_WEBHOOK_SECRET=whsec_test_... # Webhook verification
```

**Never commit .env to git!**

---

## Testing Security

### Test Cases

```bash
# 1. Brute force protection
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -d '{"email":"user@example.com","password":"wrong"}'
done
# Should get 429 after 5 attempts

# 2. Price enforcement
curl -X POST http://localhost:5000/api/payment/create-checkout \
  -H "Authorization: Bearer ..." \
  -d '{"planId":"starter","amount":1}'
# Backend ignores amount, uses $98

# 3. Subscription verification
curl http://localhost:5000/api/articles/download/article.pdf
# Should get 401 (not logged in)

# 4. Webhook signature verification
curl -X POST http://localhost:5000/webhooks/stripe \
  -H "stripe-signature: invalid" \
  -d '{...}'
# Should get 400 (signature failed)
```

---

## Attack Scenarios (Now Prevented)

| Attack | Old Code | New Code |
|--------|----------|----------|
| **Free access** | User claims payment, no verification | Webhook required |
| **Fake prices** | Frontend changes amount | Backend calculates price |
| **Token theft** | XSS steals localStorage token | httpOnly cookie (XSS can't read) |
| **Brute force** | No limit on login attempts | 5 attempts per 15 min |
| **Path traversal** | Direct PDF access `/pdfs/...` | Whitelist validation |
| **Duplicate charge** | No idempotency | Stripe idempotency keys |
| **User enum** | "Email already exists" message | Generic error messages |

---

## Next Steps: Production Deployment

1. **Database**: Replace in-memory with MongoDB/PostgreSQL
2. **HTTPS**: All communication must be encrypted
3. **Logging**: Send logs to centralized system (Datadog, LogRocket)
4. **Monitoring**: Alert on failed payments, fraudulent patterns
5. **Backups**: Daily encrypted backups of database
6. **Secrets**: Use Vault/AWS Secrets Manager instead of .env files
7. **Testing**: Load testing, penetration testing, security audit

---

## Key Takeaway

**The backend makes the rules, enforces them, and never trusts the frontend.**

Frontend displays, calculates for UX. Backend verifies, enforces, and grants access.
