# 🚀 Stripe Integration Setup Guide

## ✅ What's Already Done

Your project comes **pre-configured** with Stripe integration:
- ✅ Stripe package in package.json
- ✅ Payment routes ready
- ✅ Webhook handler configured
- ✅ Frontend forms ready
- ✅ .env template provided

## 🔧 What You Need to Do

### Step 1: Install Node.js (if not already installed)
1. Download from [nodejs.org](https://nodejs.org) - get the LTS version
2. Run the installer
3. **Restart your terminal**
4. Verify: Open terminal and type `node --version`

### Step 2: Install Dependencies
Once Node.js is installed, open terminal in the `backend/` folder and run:
```bash
npm install
```

This will install:
- Express.js (server framework)
- Stripe SDK (payment processing)
- bcryptjs (password encryption)
- express-session (user sessions)
- Helmet (security headers)
- And more...

### Step 3: Get Your Stripe Keys

**Create a FREE Stripe account:**
1. Go to https://stripe.com
2. Sign up for a free account
3. Skip the business info for now (just testing)
4. Go to https://dashboard.stripe.com/apikeys
5. Make sure **"View test data"** toggle is ON (top right)
6. Copy these values:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)
   - **Webhook Signing Secret** (in Webhooks section, see below)

### Step 4: Configure Your .env File

Edit `backend/.env` and replace the Stripe keys:

```env
# From https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret_here
```

### Step 5: Set Up Stripe Webhooks (for local testing)

This is **CRITICAL** for payment verification to work.

#### Option A: Using Stripe CLI (Recommended for Testing)
1. Download Stripe CLI: https://stripe.com/docs/stripe-cli
2. Install it
3. Authenticate: `stripe login`
4. Start webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:5000/webhooks/stripe
   ```
5. This will output a webhook signing secret - copy it to your `.env` as `STRIPE_WEBHOOK_SECRET`

#### Option B: Using Stripe Dashboard (for production)
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/webhooks/stripe`
4. Events to send:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the signing secret to `.env`

### Step 6: Start the Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
✅ Server running on port 5000
✅ Environment variables loaded
✅ Ready for payment processing
```

### Step 7: Serve the Frontend

In a **new terminal** (keep backend running):
```bash
cd web-foundations
python -m http.server 3000
```

Or if that doesn't work:
```bash
npx http-server -p 3000
```

Open http://localhost:3000 in your browser.

## 🧪 Testing the Payment Flow

### Test Account Details
Use these test values when prompted by Stripe:
- **Card Number:** 4242 4242 4242 4242
- **Expiry:** Any future date (e.g., 12/25)
- **CVC:** Any 3 digits (e.g., 123)
- **ZIP:** Any 5 digits

### Test Flow
1. Go to http://localhost:3000
2. Click "Pricing"
3. Select a plan
4. Click "Subscribe"
5. Enter test card details
6. Click "Pay"
7. You'll see "Processing..." while webhook is received
8. After 1-2 seconds, you get access to PDFs!

### Verify It Works
1. Download a PDF article
2. Open your browser DevTools (F12)
3. Go to Network tab
4. You should see the PDF being served from `/api/articles/download/`

## 🔒 Security Features (Already Implemented)

✅ **Backend Pricing**: Frontend never sends price (always backend calculated)
✅ **Webhook Verification**: Payment verified by Stripe signature (not frontend confirmation)
✅ **Idempotency Keys**: Duplicate payments prevented
✅ **Session Cookies**: Auth via httpOnly cookies (not localStorage)
✅ **Rate Limiting**: Brute force protection on auth
✅ **Audit Logging**: All payments logged

## 📊 Monitoring Payments

### Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Click "Payments"
3. See all test payments you made
4. Click any payment to see details

### Your Application
1. Payments are logged in the backend
2. Subscriptions are created ONLY when webhook is received
3. PDFs become accessible immediately after webhook verification

## 🐛 Troubleshooting

### "STRIPE_SECRET_KEY is not defined"
- Check your `.env` file exists in `backend/` folder
- Make sure you restarted the server after editing `.env`
- Run: `echo $env:STRIPE_SECRET_KEY` to verify it loaded

### "Webhook failed"
- Make sure Stripe CLI is running (or webhook URL is correct)
- Check backend is running on port 5000
- Verify `STRIPE_WEBHOOK_SECRET` in .env matches CLI output

### "Payment succeeded but no PDF access"
- Wait 2-3 seconds (webhook processing)
- Refresh the page
- Check browser console (F12) for errors
- Check backend logs for webhook errors

### "Card declined"
- You're probably using a production card (not test card)
- Use card ending in 4242 (as shown in testing section)

## 📚 Next Steps

1. **Test locally** - verify payment flow works
2. **Read security docs** - understand how it works (see [SECURITY_ARCHITECTURE.md](../SECURITY_ARCHITECTURE.md))
3. **Customize plans** - edit `backend/config/plans.js`
4. **Deploy** - follow [DEPLOYMENT.md](../DEPLOYMENT.md)
5. **Go live** - switch to production Stripe keys

## 🆘 Need Help?

### Check These Files
- `backend/routes/payment.js` - Payment endpoints
- `backend/routes/webhooks.js` - Webhook handler (CRITICAL)
- `backend/config/plans.js` - Pricing configuration
- `frontend/pricing.html` - Payment UI

### Common Questions
**Q: Can customers see my payment code?**
A: No, all payment logic is server-side. Frontend only sends planId.

**Q: What if a customer closes the payment window?**
A: They won't get access. Payment must complete + webhook verified.

**Q: How do I add new plans?**
A: Edit `backend/config/plans.js` - add to SUBSCRIPTION_PLANS object

**Q: How do I go live?**
A: Replace test keys with live keys in Stripe Dashboard, then update .env

---

**Setup Time:** 10-15 minutes
**First Payment:** 2-3 minutes
**Status:** Ready to test! 🎉
