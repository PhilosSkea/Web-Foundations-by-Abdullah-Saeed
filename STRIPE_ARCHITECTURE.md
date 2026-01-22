# 🏗️ Stripe Integration Architecture

## System Overview

```
┌─────────────────┐
│   Browser       │
│  (User Enters   │
│   Card Details) │
└────────┬────────┘
         │
         │ 1. Click "Pay"
         │    (Card to Stripe, NOT your backend)
         ▼
┌─────────────────────────────────────────┐
│      STRIPE SERVERS                     │
│  (Secure Card Processing)               │
│  - Card validation                      │
│  - Fraud detection                      │
│  - PCI compliance                       │
└─────────────────────────────────────────┘
         │
         │ 2. Payment succeeded/failed
         │
         ▼
┌─────────────────────────────────────────┐
│    YOUR BACKEND                         │
│  (Single Source of Truth)               │
│                                         │
│  1. Create Payment Intent               │
│     ✓ Enforce price server-side         │
│     ✓ Create idempotency key            │
│                                         │
│  2. Receive Webhook                     │
│     ✓ Verify signature cryptographically│
│     ✓ Grant PDF access ONLY here        │
│     ✓ Audit log all actions             │
│                                         │
└─────────────────────────────────────────┘
```

## Payment Flow (Step by Step)

### User Journey
```
1. User visits pricing.html
   ↓
2. User clicks "Choose Plan"
   ↓
3. Frontend fetches plans from /api/payment/plans
   ↓
4. Backend returns:
   - Plan ID
   - Plan Name
   - Plan Price (backend-calculated, not frontend!)
   ↓
5. User sees checkout modal with card form
   ↓
6. User enters card details
   ↓
7. User clicks "Pay"
   ↓
8. Frontend calls Stripe (NOT your backend)
   with: planId, card details
   ↓
9. Stripe processes card
   ↓
10. If successful → Stripe sends webhook to /webhooks/stripe
    ↓
11. Backend verifies webhook signature
    ↓
12. Backend grants subscription access
    ↓
13. User refreshes page → has access to PDFs
```

## API Endpoints

### Frontend Calls

```
GET /api/payment/plans
├─ Purpose: Get available plans
├─ Auth: Not required (public)
├─ Returns: [{ id, name, price, features }, ...]
└─ Security: Price from backend (never frontend)

POST /api/payment/create-checkout
├─ Purpose: Create Stripe Payment Intent
├─ Auth: Required
├─ Input: { planId }
├─ Returns: { clientSecret, paymentIntentId, publishableKey }
├─ Security:
│  ├─ planId validated (plan must exist)
│  ├─ price looked up from backend
│  ├─ idempotency key prevents duplicate charges
│  └─ User ID attached to payment record
└─ Important: Returns ONLY clientSecret, not price!

GET /api/payment/status/:paymentIntentId
├─ Purpose: Check if payment succeeded
├─ Auth: Required
├─ Returns: { status, amount, plan }
└─ Security: Only user who created it can check

GET /api/payment/subscription/status
├─ Purpose: Check current subscription
├─ Auth: Required
├─ Returns: { hasSubscription, expiresAt, plan }
└─ Used by: home.html, articles.html
```

### Backend Receives

```
POST /webhooks/stripe
├─ Source: Stripe servers (not frontend!)
├─ Security:
│  ├─ Signature verified cryptographically
│  ├─ Cannot be spoofed by frontend
│  └─ Uses STRIPE_WEBHOOK_SECRET (backend only)
├─ Events processed:
│  ├─ payment_intent.succeeded → Grant access
│  ├─ payment_intent.payment_failed → Deny access
│  ├─ charge.refunded → Revoke access
│  └─ Others → Logged for audit
└─ Critical: This is the ONLY place access is granted
```

## Code Files

### Backend

**`backend/routes/payment.js`** (120 lines)
```javascript
// GET /api/payment/plans
// - Returns public plans (no auth needed)

// POST /api/payment/create-checkout
// - Requires authentication
// - Validates plan exists
// - Gets price from backend config
// - Creates Stripe Payment Intent
// - Returns clientSecret to frontend

// GET /api/payment/status/:id
// - Checks if payment succeeded
// - Used while waiting for webhook
```

**`backend/routes/webhooks.js`** (CRITICAL - 150 lines)
```javascript
// POST /webhooks/stripe
// - Verifies Stripe signature (cryptographic proof)
// - Handles payment_intent.succeeded
//   ↳ Creates subscription record
//   ↳ Grants PDF access
// - Handles payment_intent.payment_failed
// - Handles charge.refunded
// - Idempotent (handles duplicate webhooks)
// - Comprehensive audit logging
```

**`backend/config/plans.js`** (50 lines)
```javascript
// SUBSCRIPTION_PLANS object
// - Defines all available plans
// - getPlan(id) - validates & gets plan
// - validatePlanPrice(id, amount) - fraud detection

// NEVER sent to frontend
// Frontend only gets plan ID/name
// Backend always looks up price
```

**`backend/models/user.js`** (200 lines)
```javascript
// Database schemas & operations:

// Users.create(email, password) → user
// Users.findByEmail(email) → user
// Users.findById(id) → user

// Subscriptions.create(userId, planId)
// Subscriptions.findByUserId(id) → [subs]
// Subscriptions.findActiveByUserId(id) → sub
// Subscriptions.updateStatus(id, status)

// Payments.create(userId, planId, stripeId, amount)
// Payments.findByStripeId(stripeId) → payment
// Payments.updateStatus(id, status)

// Audit.log(userId, action, details)
// Audit.getByUserId(id) → [logs]
```

### Frontend

**`pricing.html`** (612 lines)
```html
<!-- Card element form -->
<input id="card-element"></input>

<script>
  // Key functions:

  // loadPlans() - GET /api/payment/plans
  // selectPlan(planId, name, price) - show modal
  // createPaymentIntent(planId) - POST /api/payment/create-checkout
  //   ↳ Gets clientSecret back
  //   ↳ Stores it for confirmation
  // initializeStripe() - Set up Stripe.js
  // Payment form submission:
  //   ↳ stripe.confirmCardPayment(clientSecret, card)
  //   ↳ Card goes to Stripe (not your server!)
  //   ↳ Wait for webhook to grant access
</script>
```

## Security Mechanisms

### 1. Backend Pricing Enforcement
```javascript
// Bad (what we DON'T do):
const price = req.body.price; // ❌ Trust frontend?

// Good (what we DO):
const plan = getPlan(req.body.planId);
const price = plan.price; // ✅ Lookup from backend
```

### 2. Webhook Signature Verification
```javascript
// Only Stripe can create this signature
// Frontend cannot fake it
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature, // From Stripe HTTP header
  webhookSecret // Only backend knows this
);
// If signature invalid → reject webhook
```

### 3. Idempotency Keys
```javascript
// Prevents duplicate charges
const idempotencyKey = `${userId}-${planId}-${timestamp}`;
stripe.paymentIntents.create(
  { amount, currency },
  { idempotencyKey } // Stripe remembers this
);
// If same key sent twice → returns same result
```

### 4. Access Granted Only After Webhook
```javascript
// Frontend says "payment succeeded" → ignore it
// Stripe sends webhook → verify signature → grant access
// This way:
// - Frontend cannot fake payment
// - Network issues don't grant fake access
// - Refunds are handled properly
```

### 5. Audit Logging
```javascript
// Every sensitive action logged:
db.audit.log(userId, 'payment_succeeded', {
  paymentId: '...',
  amount: 9800,
  planId: 'starter',
  timestamp: new Date()
});

// Later:
db.audit.getByUserId(userId) // See all user actions
```

## Fraud Prevention

### What We Prevent

| Attack | How We Stop It |
|--------|---|
| Customer pays $9, gets $99 plan | Backend enforces price |
| Customer fakes payment | Webhook signature required |
| Duplicate charges from network retry | Idempotency keys |
| User gets access before paying | Access granted by webhook only |
| Refund fraud | Webhook handles charge.refunded |
| Password brute force | Rate limiting (5/15min) |
| User enumeration | Generic error messages |

### Assumptions (What We Trust)

- ✅ Stripe (cryptographic verification)
- ✅ Your backend (it's your server)
- ❌ Frontend (user can modify)
- ❌ Network (can be eavesdropped without HTTPS)
- ❌ Localhost (not secure, only for testing)

## Database Schema (Current: In-Memory)

```javascript
Users {
  id: uuid,
  email: string (unique),
  password_hash: bcrypt,
  created_at: timestamp,
  last_login: timestamp
}

Subscriptions {
  id: uuid,
  user_id: uuid,
  plan_id: string,
  stripe_subscription_id: string,
  status: 'active' | 'canceled' | 'expired',
  expires_at: timestamp,
  created_at: timestamp
}

Payments {
  id: uuid,
  user_id: uuid,
  stripe_payment_intent_id: string,
  amount: number (in cents),
  status: 'pending' | 'succeeded' | 'failed',
  plan_id: string,
  created_at: timestamp
}

AuditLog {
  id: uuid,
  user_id: uuid,
  action: string,
  details: object,
  ip: string,
  timestamp: timestamp
}
```

## Deployment Checklist

- [ ] Replace test keys with production Stripe keys
- [ ] Configure webhook URL in Stripe Dashboard
- [ ] Set up database (MongoDB/PostgreSQL)
- [ ] Enable HTTPS
- [ ] Set strong SESSION_SECRET and JWT_SECRET
- [ ] Configure CORS to your domain
- [ ] Set up error monitoring (Sentry)
- [ ] Enable audit log monitoring
- [ ] Load test
- [ ] Ready to go live! 🎉

## Testing Checklist

- [ ] Can create account
- [ ] Can login
- [ ] Can see pricing page
- [ ] Can click "Choose Plan"
- [ ] Payment form appears
- [ ] Can enter test card
- [ ] Payment processes
- [ ] Can see payment in Stripe Dashboard
- [ ] Webhook fires (check backend logs)
- [ ] Subscription created in database
- [ ] Can download PDF
- [ ] Access expires after plan duration
- [ ] Refund removes access

## References

- Stripe API Docs: https://stripe.com/docs/api
- Stripe Testing: https://stripe.com/docs/testing
- Payment Intents: https://stripe.com/docs/payments/payment-intents
- Webhooks: https://stripe.com/docs/webhooks
- PCI Compliance: https://stripe.com/docs/security
