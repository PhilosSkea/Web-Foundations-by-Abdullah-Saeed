# 🎯 Stripe Integration - Complete Setup

**Your system is ready to run! Here's exactly what to do:**

## Phase 1: One-Time Setup (5 minutes)

### 1. Install Node.js

If you haven't already:
1. Go to https://nodejs.org
2. Download "LTS" version
3. Run installer, accept defaults
4. **Restart PowerShell** (close and reopen)
5. Verify: `node --version` should show v18 or higher

### 2. Create `.env` File

**File:** `backend/.env` (copy-paste this)

```dotenv
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_super_secret_session_key_minimum_32_characters_required_12345
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_required_here_123456
DATABASE_URL=memory://localhost
STRIPE_SECRET_KEY=sk_test_4eC39HqLyjWDarhtT657654321
STRIPE_PUBLISHABLE_KEY=pk_test_51LoUHKA1JVGqVLbHjKLhkjlhkjlhj
STRIPE_WEBHOOK_SECRET=whsec_test_1234567890123456789012345
FRONTEND_URL=http://localhost:3000
FRONTEND_PAYMENT_URL=http://localhost:3000/pricing
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=onboarding@resend.dev
SMTP_PASS=dummy_password_for_dev
LOG_LEVEL=debug
```

**Replace Stripe keys (important!):**
1. Go to https://dashboard.stripe.com/apikeys
2. Make sure "View test data" is ON
3. Copy your test keys and paste above

### 3. Install Dependencies

```powershell
cd "C:\Users\Chem Zone\OneDrive\Desktop\web-foundations\backend"
npm install
```

This installs all npm packages including Stripe.

---

## Phase 2: Run Locally (Every Time)

### Setup: Open 2 PowerShell Windows

**Window 1: Backend Server**
```powershell
cd "C:\Users\Chem Zone\OneDrive\Desktop\web-foundations\backend"
npm run dev
```

You should see:
```
✅ Server running on port 5000
✅ All environment variables loaded
✅ Ready for incoming requests
```

**Window 2: Frontend Server**
```powershell
cd "C:\Users\Chem Zone\OneDrive\Desktop\web-foundations"
python -m http.server 3000
```

You should see:
```
Serving HTTP on 0.0.0.0 port 3000 ...
```

If Python doesn't work, try:
```powershell
npx http-server -p 3000
```

### Open in Browser

Go to: **http://localhost:3000**

---

## Phase 3: Test the Full Payment Flow

### 1. Create Account
- Click **Login**
- Click **Sign Up**
- Enter email & password
- Submit

### 2. Go to Pricing
- Click **Pricing** in navbar
- You should see 3 plans

### 3. Make a Test Payment
- Click **Choose Plan** on any plan
- Modal appears with payment form
- Enter test card:
  - **Card Number:** `4242 4242 4242 4242`
  - **Expiry:** `12/25` (or any future date)
  - **CVC:** `123`
  - **ZIP:** `12345`
- Click **Pay**

### 4. Expected Result
- "Processing..." appears
- After 1-2 seconds: "Payment successful!"
- You're redirected to home.html
- You can download PDFs

If it doesn't work, see "Troubleshooting" below.

---

## Phase 4: Enable Webhooks (Optional but Recommended)

Webhooks are how Stripe confirms payment to your backend. Without them, access is instant but not verified.

### Using Stripe CLI (Recommended for Testing)

1. Download Stripe CLI: https://stripe.com/docs/stripe-cli
2. Install it
3. In a 3rd PowerShell window:
```powershell
stripe login
```
4. Then:
```powershell
stripe listen --forward-to localhost:5000/webhooks/stripe
```

You'll see:
```
> Ready! Your webhook signing secret is: whsec_test_xxxxx
```

5. Copy that secret and update `.env`:
```dotenv
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

6. **Restart the backend server** (Ctrl+C, then `npm run dev`)

7. Now test payment again - webhooks will fire!

### Without Stripe CLI
- Payments will work locally
- But webhooks won't be received
- Your code is production-ready, just can't test locally

---

## Phase 5: Monitor Everything

### See Your Payments
1. Go to https://dashboard.stripe.com/payments
2. You'll see all test payments
3. Click any payment for details

### Check Backend Logs
- Look at the PowerShell window running `npm run dev`
- You'll see API requests and webhook events

### Check Browser Console
- Press **F12** in browser
- Go to **Console** tab
- See JavaScript logs
- Go to **Network** tab
- Watch API calls happen

---

## 🔧 Quick Commands

```powershell
# View environment variables
Get-Content "C:\Users\Chem Zone\OneDrive\Desktop\web-foundations\backend\.env"

# Check if Node.js is installed
node --version

# Check if npm packages are installed
cd backend
ls node_modules

# Restart backend (if it crashes)
# Press Ctrl+C in the backend window
# Then: npm run dev

# Kill process on port (if stuck)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
```

---

## 🧪 Test Cases to Try

| Test | Steps | Expected |
|------|-------|----------|
| **Valid Card** | Enter 4242...4242, click Pay | Success ✅ |
| **Declined Card** | Enter 4000000000000002, click Pay | Declined error ✅ |
| **Wrong Expiry** | Enter past date like 01/20, click Pay | Error ✅ |
| **Partial Card** | Enter 4242424, click Pay | Validation error ✅ |
| **Browser Back** | Click back during payment | Payment still processes ✅ |
| **Multiple Plans** | Buy different plans | All create separate payments ✅ |

---

## 🆘 Troubleshooting

### Problem: "npm: command not found"
**Solution:** Node.js not installed or PATH not updated
1. Download from nodejs.org
2. Install
3. **Close and reopen PowerShell completely**
4. Try `node --version` again

### Problem: "Cannot find module 'stripe'"
**Solution:** Dependencies not installed
```powershell
cd backend
npm install
```

### Problem: "Port 5000 already in use"
**Solution:** Another process is using it
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
npm run dev
```

### Problem: "STRIPE_SECRET_KEY is not defined"
**Solution:** .env file not loading
1. Check `.env` exists in `backend/` folder
2. Verify it has `STRIPE_SECRET_KEY=sk_test_...`
3. Restart backend: Ctrl+C, then `npm run dev`

### Problem: "Module not found: stripe"
**Solution:** Install stripe package
```powershell
cd backend
npm install stripe
```

### Problem: Payment shows error on page
**Solution:** Check error details
1. Press F12 (DevTools)
2. Go to Console tab
3. Look for error message
4. Check backend logs in PowerShell
5. Verify Stripe keys are correct in .env

### Problem: "Cannot POST /api/payment/create-checkout"
**Solution:** Backend not running or wrong port
1. Check backend window shows "Server running on port 5000"
2. Verify frontend connects to localhost:5000 (not 3000)
3. Restart backend

### Problem: Card element doesn't appear
**Solution:** Stripe.js not loading
1. Check internet connection
2. Check browser console for errors (F12)
3. Verify STRIPE_PUBLISHABLE_KEY in .env is valid

### Problem: "Webhook failed" in logs
**Solution:** Stripe CLI not running or wrong secret
1. Start: `stripe listen --forward-to localhost:5000/webhooks/stripe`
2. Copy webhook secret to .env
3. Restart backend
4. Try payment again

---

## 📊 Files You Have

```
backend/
├── server.js                 ← Express server
├── package.json              ← Dependencies
├── .env                      ← Your secrets (NEVER commit!)
├── config/plans.js           ← Pricing config
├── middleware/auth.js        ← Authentication
├── models/user.js            ← Database schemas
├── routes/
│   ├── auth.js              ← Login/signup
│   ├── payment.js           ← Payment endpoints
│   ├── articles.js          ← PDF serving
│   └── webhooks.js          ← Stripe webhooks
└── node_modules/            ← Installed packages (don't edit)

frontend (in root):
├── pricing.html             ← Payment page
├── login.html               ← Auth page
├── home.html                ← Protected page
└── style.css                ← Styling
```

---

## ✅ Success Checklist

- [ ] Node.js installed (`node --version` works)
- [ ] `.env` file created with Stripe keys
- [ ] `npm install` completed in backend
- [ ] Backend runs: `npm run dev` shows port 5000
- [ ] Frontend runs: `python -m http.server 3000`
- [ ] Can visit http://localhost:3000
- [ ] Can create account and login
- [ ] Can see pricing page with 3 plans
- [ ] Can make test payment with 4242 card
- [ ] Payment appears in Stripe Dashboard
- [ ] Can download PDFs after payment

---

## 🎉 You're Ready!

Everything is set up. Now:

1. **Run it locally** - test the full flow
2. **Read STRIPE_ARCHITECTURE.md** - understand how it works
3. **Deploy** - when ready (see DEPLOYMENT.md)
4. **Go live** - switch to production Stripe keys

**Start here:** http://localhost:3000

Questions? Check STRIPE_SETUP.md for detailed explanations.
