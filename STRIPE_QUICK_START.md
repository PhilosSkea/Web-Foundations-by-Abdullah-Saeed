# ⚡ Quick Start - Stripe Integration

## 1️⃣ Prerequisites (5 minutes)

### Install Node.js
- Download from https://nodejs.org (LTS version)
- Install and restart your terminal
- Verify: `node --version`

### Get Stripe Keys
- Create free account: https://stripe.com/register
- Go to https://dashboard.stripe.com/apikeys
- Toggle **"View test data"** ON
- Copy these values:
  - `sk_test_...` (Secret Key)
  - `pk_test_...` (Publishable Key)

## 2️⃣ Configure Environment (2 minutes)

Edit `backend/.env`:
```dotenv
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_WEBHOOK_SECRET
```

**Don't have webhook secret yet?** Skip it for now, we'll set it up in Step 4.

## 3️⃣ Install & Start (3 minutes)

### Terminal 1 - Backend
```bash
cd backend
npm install
npm run dev
```

Expected output:
```
✅ Server running on port 5000
✅ All environment variables loaded
```

### Terminal 2 - Frontend
```bash
python -m http.server 3000
```

Or if that doesn't work:
```bash
npx http-server -p 3000
```

**Open:** http://localhost:3000

## 4️⃣ Test Payment (2 minutes)

1. Click **"Pricing"** → Choose a plan → **"Subscribe"**
2. Enter test card: `4242 4242 4242 4242`
3. Expiry: Any future date (e.g., `12/25`)
4. CVC: Any 3 digits (e.g., `123`)
5. Click **"Pay"**

### Without Webhooks (Payment will be "pending")
If you don't have webhooks set up yet, the payment will succeed but you won't get PDF access.

### With Webhooks (Full flow - Recommended)
Follow Step 5 below to enable webhooks and get instant access.

## 5️⃣ Enable Webhooks (Optional but Recommended)

This ensures payment confirmation works properly.

### Using Stripe CLI (Best for Testing)
```bash
# Download from: https://stripe.com/docs/stripe-cli
# Then:
stripe login
stripe listen --forward-to localhost:5000/webhooks/stripe
```

You'll see:
```
> Ready! Your webhook signing secret is: whsec_test_xxxxx
```

Copy that secret to `.env` as `STRIPE_WEBHOOK_SECRET`.

**Restart** the backend server (press Ctrl+C, then `npm run dev`).

### Without Stripe CLI
Webhooks won't work locally, but the code is production-ready.

## 🧪 Test Cases

| Test | Expected Result |
|------|---|
| Pay with test card | Payment intent created ✅ |
| With webhooks enabled | PDF access granted ✅ |
| Without webhooks | Payment "pending" (no access yet) |
| Use bad card (4000000000000002) | Payment declined ✅ |
| Close browser during payment | Payment still processes (backend handles it) ✅ |

## 📊 Monitor Payments

### In Stripe Dashboard
1. Go to https://dashboard.stripe.com/payments
2. See all test payments
3. Click any payment for details

### In Browser Console
- Open DevTools (F12)
- Go to Network tab
- Watch API calls to `/api/payment/`

### In Backend Logs
- Check terminal where backend is running
- See all API hits and webhook events

## ✅ Verify Setup

```bash
# Check environment variables loaded:
cd backend && npm run dev
# Should show: ✅ All environment variables loaded

# Test backend:
curl http://localhost:5000/api/payment/plans
# Should return plan list

# Test frontend authentication:
curl http://localhost:5000/api/auth/me
# Should return 401 (not authenticated)
```

## 🆘 Troubleshooting

### "Cannot find module 'stripe'"
```bash
cd backend && npm install
```

### "STRIPE_SECRET_KEY is not defined"
- Check `.env` exists and has correct key
- Restart backend: Ctrl+C then `npm run dev`

### Payment shows error on page
- Check browser console (F12)
- Check backend logs in terminal
- Verify publishable key matches your Stripe account

### Webhooks not firing
- Make sure `stripe listen` is running
- Check STRIPE_WEBHOOK_SECRET in .env matches CLI output
- Restart backend after updating .env

## 🎯 What's Working

✅ Real Stripe API integration  
✅ Backend-enforced pricing  
✅ Frontend payment form  
✅ Payment Intent flow  
✅ Error handling  

⚠️ Needs webhooks to grant PDF access  
⚠️ Database is in-memory (data lost on restart)  

## 📚 Next Steps

1. **Keep it running locally** - test the full flow
2. **Read docs** - understand the security model
3. **Deploy** - when ready (see DEPLOYMENT.md)
4. **Go live** - switch to production Stripe keys

## 🚀 You're Ready!

Go to http://localhost:3000 and test it out! 🎉
