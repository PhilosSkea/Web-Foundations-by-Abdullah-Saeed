# 🎯 Stripe Integration - Visual Guide

## System Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    YOUR STRIPE SYSTEM                        │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐         Step 1: View Plans
│   Browser   │◄──────────GET /api/payment/plans
│   (User)    │          ┌──────────────────┐
└──────┬──────┘          │ Backend Returns: │
       │                 │ - Starter: $98   │
       │                 │ - Pro: $498      │
       │                 │ - Max: $998      │
       │                 └──────────────────┘
       │
       │         Step 2: Choose Plan & Show Modal
       ▼
   ┌────────────────────────────────┐
   │  Checkout Form Appears         │
   │  Card Element (Stripe.js)      │
   │  User enters card details      │
   └──────────────────┬─────────────┘
                      │
                      │ Step 3: User clicks "Pay"
                      │         Send to Stripe
                      ▼
    ┌───────────────────────────────┐
    │  STRIPE SERVERS               │
    │  (Secure - Never your code)   │
    │                               │
    │  - Validate card              │
    │  - Check fraud                │
    │  - Process payment            │
    │  - Return result              │
    └───────────────────┬───────────┘
                        │
                        │ Step 4: Webhook sent to backend
                        │  /webhooks/stripe
                        │
                        ▼
    ┌───────────────────────────────┐
    │  YOUR BACKEND                 │
    │                               │
    │  1. Verify signature          │
    │     (Stripe proof)            │
    │  2. Check amount              │
    │  3. Create subscription       │
    │  4. Grant PDF access          │
    │  5. Log to audit trail        │
    └───────────────────┬───────────┘
                        │
                        │ Step 5: User now has access
                        │
                        ▼
    ┌───────────────────────────────┐
    │  User Can Download PDFs       │
    │  /api/articles/download/...   │
    │                               │
    │  All protected & logged       │
    └───────────────────────────────┘
```

## Key Security Points

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST MODEL                              │
└─────────────────────────────────────────────────────────────┘

❌ Frontend Cannot:
   ├─ Fake payment (Stripe webhook required)
   ├─ Change price (backend enforces it)
   ├─ Grant access (backend decides)
   ├─ Spoof webhook (cryptographic signature)
   └─ Access PDFs (subscription verified)

✅ Backend Does:
   ├─ Calculate prices from config
   ├─ Verify webhook cryptographically
   ├─ Create subscriptions
   ├─ Grant file access
   ├─ Log all actions
   └─ Enforce rate limits

✅ Stripe Does:
   ├─ Process cards securely
   ├─ Send verified webhooks
   ├─ Handle fraud detection
   ├─ Maintain PCI compliance
   └─ Manage customer data
```

## File Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                   FRONTEND (Browser)                         │
│  pricing.html                                                │
│  ├─ Uses Stripe.js library                                   │
│  ├─ Calls /api/payment/plans                                 │
│  ├─ Calls /api/payment/create-checkout                       │
│  └─ Confirms payment with Stripe                             │
└────────────┬───────────────────────────────────────────────┘
             │
             │ HTTP/REST API
             ▼
┌──────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js)                          │
│                                                              │
│  server.js                                                   │
│  ├─ Loads environment (.env)                                │
│  ├─ Sets up security (Helmet, CORS, rate limit)            │
│  ├─ Mounts routes                                           │
│  └─ Starts on port 5000                                     │
│                                                              │
│  routes/payment.js                                           │
│  ├─ GET /plans → config/plans.js                            │
│  ├─ POST /create-checkout                                   │
│  │   ├─ Validates user (middleware/auth.js)               │
│  │   ├─ Gets price from config/plans.js                     │
│  │   ├─ Creates Stripe Payment Intent                       │
│  │   └─ Saves to models/user.js                             │
│  └─ GET /subscription/status                                │
│                                                              │
│  routes/webhooks.js ⭐ CRITICAL                             │
│  ├─ POST /webhooks/stripe                                   │
│  ├─ Verifies signature (cryptographic proof)               │
│  ├─ Calls handlePaymentSucceeded()                         │
│  │   ├─ Gets payment from models/user.js                    │
│  │   ├─ Creates subscription                                │
│  │   └─ Logs audit event                                    │
│  └─ Handles refunds, failures                               │
│                                                              │
│  config/plans.js                                             │
│  ├─ Defines SUBSCRIPTION_PLANS                              │
│  ├─ getPlan(id) - lookup & validate                         │
│  ├─ validatePlanPrice(id, amount) - fraud check             │
│  └─ getPublicPlans() - frontend-safe export                │
│                                                              │
│  models/user.js                                              │
│  ├─ Users table (id, email, password_hash, ...)            │
│  ├─ Subscriptions table (id, user_id, plan_id, ...)        │
│  ├─ Payments table (id, user_id, stripe_id, ...)           │
│  ├─ Audit table (id, user_id, action, ...)                 │
│  └─ CRUD operations for all                                 │
│                                                              │
│  middleware/auth.js                                          │
│  ├─ requireAuth - checks session                             │
│  ├─ requireSubscription - checks subscription                │
│  └─ Generic errors (no user enumeration)                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   EXTERNAL (Stripe)                          │
│                                                              │
│  Payment Processing                                          │
│  ├─ https://stripe.com/api/*                                │
│  ├─ Create Payment Intent                                    │
│  ├─ Confirm payment (from frontend)                         │
│  └─ Send webhook callbacks                                   │
│                                                              │
│  Webhooks                                                    │
│  └─ POST /webhooks/stripe (in your backend)                 │
│     ├─ payment_intent.succeeded                              │
│     ├─ payment_intent.payment_failed                        │
│     └─ charge.refunded                                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   ENVIRONMENT (.env)                         │
│                                                              │
│  PORT=5000                                                  │
│  NODE_ENV=development                                       │
│  SESSION_SECRET=***                                         │
│  JWT_SECRET=***                                             │
│  DATABASE_URL=memory://localhost                            │
│  STRIPE_SECRET_KEY=sk_test_***       ← Get from Stripe     │
│  STRIPE_PUBLISHABLE_KEY=pk_test_***  ← Get from Stripe     │
│  STRIPE_WEBHOOK_SECRET=whsec_***     ← Get from Stripe CLI │
│  FRONTEND_URL=http://localhost:3000                         │
│  ... (others)                                               │
└──────────────────────────────────────────────────────────────┘
```

## Request/Response Flow

```
USER ACTION: Click "Choose Plan"
│
├─ Frontend: GET /api/payment/plans
│  ├─ Backend receives request
│  ├─ Calls getPublicPlans() from config/plans.js
│  └─ Response: [{ id, name, price, features }, ...]
│
└─ Frontend: Display plans in modal


USER ACTION: Click "Pay"
│
├─ Frontend: POST /api/payment/create-checkout
│  ├─ Body: { planId: "pro" }
│  ├─ Backend receives request
│  ├─ Middleware auth.js: Verify session ✓
│  ├─ routes/payment.js:
│  │  ├─ Validate planId
│  │  ├─ Get plan from config/plans.js
│  │  ├─ Create Stripe Payment Intent (with BACKEND price)
│  │  ├─ Create payment record in models/user.js
│  │  └─ Return: { clientSecret, publishableKey }
│  └─ Response: 200 OK + clientSecret
│
└─ Frontend: Confirm payment with Stripe


STRIPE → YOUR BACKEND: Webhook
│
├─ Incoming: POST /webhooks/stripe
│  ├─ Body: Stripe event (payment_intent.succeeded)
│  ├─ Header: Signature (proves it's from Stripe)
│  ├─ routes/webhooks.js:
│  │  ├─ Verify signature with STRIPE_WEBHOOK_SECRET ✓
│  │  ├─ Verify amount matches plan ✓
│  │  ├─ Create subscription in models/user.js
│  │  ├─ Log to audit trail
│  │  └─ Return: 200 OK
│  └─ Response: 200 OK
│
└─ Frontend: User now has access to PDFs
```

## Data Flow Through System

```
User Registration
├─ Email & Password → route/auth.js
├─ Validate & hash → bcryptjs
├─ Save to models/user.js
└─ Create session

User Login  
├─ Email & Password → routes/auth.js
├─ Compare with bcrypt
├─ Create session cookie (httpOnly)
└─ Session stored in memory

Choose Plan
├─ Frontend requests /plans
├─ Backend returns from config/plans.js
└─ User selects & initiates checkout

Payment Processing
├─ Frontend sends planId → POST /create-checkout
├─ Backend:
│  ├─ Verifies user authenticated
│  ├─ Looks up price from config/plans.js
│  ├─ Creates Stripe Payment Intent
│  ├─ Saves payment record to models/user.js
│  └─ Returns clientSecret
├─ Frontend sends card → Stripe (NOT backend)
├─ Stripe processes & sends webhook
├─ Backend receives webhook
├─ Backend verifies signature
├─ Backend creates subscription
├─ Backend logs to audit trail
└─ User gets access to PDFs

Access Protected Content
├─ Frontend requests /api/articles/download/file.pdf
├─ Backend checks session (middleware)
├─ Backend checks subscription (middleware)
├─ Backend checks whitelist (security)
├─ Backend streams PDF file
└─ User downloads file
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│              DEFENSE IN DEPTH (6 LAYERS)                   │
└─────────────────────────────────────────────────────────────┘

Layer 1: HTTPS (Transport Security)
├─ Encrypts all communication
├─ Prevents man-in-the-middle attacks
└─ Required for production

Layer 2: Authentication (Session Cookies)
├─ httpOnly cookies (XSS-safe)
├─ Encrypted session data
├─ Rate limiting (5 attempts/15min)
└─ Timeout after inactivity

Layer 3: Authorization (Subscription Check)
├─ Verify user has active subscription
├─ Check expiration date
├─ Enforce plan access rules
└─ Generic error messages (no enumeration)

Layer 4: Input Validation
├─ Validate all request data
├─ Reject invalid planId
├─ Check amount matches backend price
└─ Prevent injection attacks

Layer 5: Cryptographic Verification
├─ Stripe webhook signature verification
├─ Proves message is from Stripe
├─ Cannot be forged (uses secret key)
└─ Checked on every webhook

Layer 6: Audit Logging
├─ Log all sensitive actions
├─ Track payment history
├─ Record access to PDFs
├─ Enable compliance & fraud detection
└─ Stored with timestamps & IPs
```

## File Access Control

```
Direct File Access (BLOCKED)
│
├─ GET /pdfs/article.pdf ❌
│  └─ Serves static files, anyone can access
│
└─ GET /backend/models/user.js ❌
   └─ Backend files, not accessible


Protected API Access (ALLOWED)
│
├─ GET /api/articles/download/article.pdf ✓
│  ├─ requireAuth middleware checks session
│  ├─ requireSubscription checks subscription
│  ├─ Whitelist prevents path traversal
│  └─ File streamed only if all checks pass
│
└─ GET /api/articles/public ✓
   └─ Returns preview only (no PDFs)
```

---

**This visual guide shows how all the pieces work together!**

For detailed explanations, see [STRIPE_ARCHITECTURE.md](STRIPE_ARCHITECTURE.md)
