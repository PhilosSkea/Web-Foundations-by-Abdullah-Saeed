# Developer Quick Reference

## 🚀 Start Here

### Project Goals
- Sell articles (text, image, PDF) via subscription
- Plans: 10 articles ($98), 50 articles ($498), unlimited 1-year ($998)
- Payments via Stripe with webhook verification
- Backend is the single source of truth

### Key Principle
**Never trust the frontend.** Backend validates everything.

---

## 📦 Setup (5 minutes)

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env
# Edit .env: add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SESSION_SECRET
npm run dev

# 2. Frontend (separate terminal)
# Serve from root directory
python -m http.server 3000

# 3. Test
curl http://localhost:5000/api/health
# Should return: {"status":"ok",...}

# 4. Open browser
http://localhost:3000
# Should redirect to login
```

---

## 🔐 Security Overview (30 seconds)

```
User sends credentials
    ↓
[Backend validates password (bcrypt)]
    ↓
[Backend creates httpOnly cookie]
    ↓
[Browser auto-sends cookie on every request]
    ↓
[Backend verifies session on every endpoint]
    ↓
[Frontend can NEVER forge auth]
```

**Key difference from old code:**
- ❌ localStorage tokens (XSS steals it)
- ✅ httpOnly cookies (XSS cannot read it)

---

## 💳 Payment Flow (The Critical Path)

### What Happens When User Buys

```
1️⃣  Frontend sends ONLY: { planId: "starter" }
2️⃣  Backend looks up price from config: $98
3️⃣  Backend creates Stripe Payment Intent with $98
4️⃣  Frontend receives clientSecret
5️⃣  User enters card in Stripe modal
6️⃣  Stripe processes payment
7️⃣  Stripe sends webhook to backend
8️⃣  Backend verifies: signature ✓ + amount ✓
9️⃣  Backend creates subscription
🔟 User gets access

Attacker cannot:
- Change price (backend enforces)
- Claim payment without paying (webhook required)
- Fake completion (signature verified)
```

### Code Locations

| Task | File |
|------|------|
| Plans defined | `config/plans.js` |
| Create checkout | `routes/payment.js:25-77` |
| Handle payment | `routes/webhooks.js:82-134` |
| Check access | `middleware/auth.js:33-45` |
| Serve PDFs | `routes/articles.js:104-165` |

---

## 🔧 Common Tasks

### Add a New Plan

```javascript
// backend/config/plans.js

export const SUBSCRIPTION_PLANS = {
  // ... existing plans
  
  pro: {
    id: 'pro',
    name: 'Professional',
    price: 29800, // $298 in cents
    articles_limit: 25,
    duration_days: 30,
    features: ['25 articles/month', '...']
  }
};
```

Frontend automatically gets it from `/api/payment/plans`.

### Add a Protected Endpoint

```javascript
// backend/routes/api.js

import { requireAuth, requireSubscription } from '../middleware/auth.js';

// User must be logged in
router.get('/secret', requireAuth, (req, res) => {
  res.json({ userId: req.userId });
});

// User must have active subscription
router.get('/premium', requireSubscription, (req, res) => {
  res.json({ subscription: req.subscription });
});
```

### Add Audit Logging

```javascript
// Any important action:
await db.audit.log(userId, 'action_name', {
  details: 'what happened',
  ip: req.ip
});
```

---

## 🧪 Testing

### Test Auth Flow

```bash
# 1. Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPass123!@#",
    "name":"Test",
    "confirmPassword":"TestPass123!@#"
  }'

# 2. Check session
curl http://localhost:5000/api/auth/me

# Should return: {"authenticated":true,"user":{...}}
```

### Test Payment Flow

```bash
# 1. Create payment intent
curl -X POST http://localhost:5000/api/payment/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"planId":"starter"}'

# 2. Verify plan retrieved
# Should show $98, not any other amount

# 3. Simulate Stripe webhook
stripe trigger payment_intent.succeeded

# 4. Check subscription
curl http://localhost:5000/api/payment/subscription/status
# Should show active subscription
```

### Test PDF Protection

```bash
# Without auth (should fail)
curl http://localhost:5000/api/articles/download/article.pdf
# 401 Unauthorized

# With auth but no subscription (should fail)
curl -H "Authorization: Bearer ..." \
  http://localhost:5000/api/articles/download/article.pdf
# 403 Forbidden (no subscription)

# With subscription (should work)
# First buy plan, then:
curl http://localhost:5000/api/articles/download/article.pdf
# Streams PDF
```

---

## 🐛 Debugging

### Check Backend Logs

```bash
# Terminal running backend (npm run dev)
# Should see:
# ✅ Webhook event: payment_intent.succeeded
# ✅ Payment succeeded: pi_xxx
# 🎉 Subscription created
```

### Check Database

```javascript
// backend/models/user.js contains all data
// In-memory only (for development)

// Get all users
console.log(users);

// Get subscriptions for user
const subs = await db.subscriptions.findByUserId(userId);

// Get audit logs
const logs = await db.audit.getByUserId(userId);
```

### Check Stripe Status

1. Go to https://dashboard.stripe.com
2. Look at test API keys
3. Check webhook deliveries (Settings → Webhooks)
4. Test card: 4242 4242 4242 4242

---

## 📝 Important Files

### Security (Must Understand)

| File | Purpose | Why Important |
|------|---------|---------------|
| `routes/webhooks.js` | Handle Stripe webhooks | **Subscriptions created here only** |
| `routes/payment.js` | Payment endpoints | Backend enforces price |
| `routes/articles.js` | PDF serving | Protected access check |
| `middleware/auth.js` | Auth checks | Protects all endpoints |
| `config/plans.js` | Plan definitions | Source of truth for prices |

### Configuration

| File | Purpose |
|------|---------|
| `.env` | Secrets (never commit!) |
| `server.js` | Security headers, rate limiting |
| `package.json` | Dependencies |

### Models

| File | Purpose |
|------|---------|
| `models/user.js` | User, subscription, payment schemas |

---

## ⚠️ Things That Will BREAK Your App

### ❌ Never Do This

```javascript
// ❌ Trust frontend price
const amount = req.body.amount;

// ❌ Create subscription before payment
await db.subscriptions.create(req.body);

// ❌ Send secrets to frontend
res.json({ apiKey: process.env.STRIPE_SECRET_KEY });

// ❌ Serve PDFs directly
// Instead of /api/articles/download/file.pdf

// ❌ Skip signature verification
// Always verify Stripe webhooks

// ❌ Weak passwords
// Enforce 12+ characters with uppercase, numbers, symbols

// ❌ Log sensitive data
// console.log(password) // NEVER
console.log(email); // OK (not a secret)
```

### ✅ Always Do This

```javascript
// ✅ Backend calculates price
const plan = getPlan(planId);
const amount = plan.price;

// ✅ Create subscription AFTER webhook
async function handlePaymentSucceeded(intent) {
  // Verify signature, verify amount, THEN create
}

// ✅ Keep secrets in .env
const secret = process.env.STRIPE_SECRET_KEY;

// ✅ Protect all resources
GET /api/resource
  → [requireAuth] → [requireSubscription] → [whitelist] → [serve]

// ✅ Always verify webhooks
stripe.webhooks.constructEvent(body, sig, SECRET);

// ✅ Enforce password requirements
if (!PASSWORD_REGEX.test(password)) throw Error;

// ✅ Audit log sensitive actions
await db.audit.log(userId, 'action', { details });
```

---

## 📊 Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│  index.html, login.html, pricing.html, home.html        │
│  (Plain HTML/JS, no build step)                         │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTPS only
┌──────────────────▼───────────────────────────────────────┐
│                     BACKEND                              │
│                  (Express.js)                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Security Layer (Helmet, CORS, Rate Limiting)       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Auth Routes (bcrypt, session cookies)             │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Payment Routes (backend-enforced pricing)         │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Articles Routes (protected PDF serving)           │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Webhook Routes (Stripe signature verification)    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Database (Users, Subscriptions, Payments)         │ │
│  │ + Audit Log                                        │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────┘
               │ Webhook signature
┌──────────────▼───────────────────────────────────────────┐
│                      STRIPE                              │
│         (Payment processing, signature signing)         │
└──────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation

Start here:
1. **This file** - Quick reference
2. **SECURITY_AUDIT.md** - What was wrong
3. **SECURITY_ARCHITECTURE.md** - How it works
4. **PRODUCTION_SUMMARY.md** - Implementation details
5. **DEPLOYMENT.md** - Going to production

---

## 🆘 Need Help?

### "I don't understand the security model"
→ Read SECURITY_ARCHITECTURE.md (explains trust boundaries)

### "How do I add X feature?"
→ Check code comments (every security decision documented)

### "Is this production ready?"
→ Read PRODUCTION_SUMMARY.md (checklist + status)

### "How do I deploy?"
→ Read DEPLOYMENT.md (step-by-step)

### "Where is X code?"
→ See "Important Files" section above

---

## ✅ Verification Checklist

Before committing:

- [ ] No hardcoded secrets
- [ ] All .env values in .env (not code)
- [ ] Tests pass locally
- [ ] No console.log(password/tokens)
- [ ] Database schema documented
- [ ] Stripe webhook tested
- [ ] PDF access verified

---

## 🎯 Next Phase

- [ ] Replace in-memory DB with MongoDB
- [ ] Add Sentry error tracking
- [ ] Add email verification
- [ ] Add 2FA
- [ ] Add fraud detection
- [ ] Implement refresh tokens
- [ ] Add admin dashboard

---

**Remember:** Backend is always right. Frontend is just a UI.
