# Production Deployment Guide

## Pre-Deployment Checklist

### Code & Security
- [ ] All dependencies updated (`npm audit fix`)
- [ ] No hardcoded secrets in code
- [ ] Environment variables configured
- [ ] `.env` added to `.gitignore`
- [ ] CORS configured for production domain
- [ ] HTTPS only (redirect HTTP → HTTPS)
- [ ] Security headers configured (Helmet)
- [ ] Rate limiting active

### Stripe Configuration
- [ ] Stripe account created and verified
- [ ] Live API keys generated (not test keys)
- [ ] Webhook endpoint registered
- [ ] Webhook signature secret saved to `.env`
- [ ] Payment Intent testing completed
- [ ] Refund flow tested

### Database
- [ ] Database selected (MongoDB/PostgreSQL)
- [ ] Database hosted (Atlas/RDS)
- [ ] Backups configured
- [ ] Connection string in `.env`
- [ ] Migrations run successfully
- [ ] Database indexes created

### Monitoring & Logging
- [ ] Logging service configured (Sentry/Datadog)
- [ ] Error alerts configured
- [ ] Payment failure alerts configured
- [ ] Daily backup alerts configured
- [ ] Suspicious activity detection

---

## Environment Variables (Production)

```bash
# .env (production)
PORT=443
NODE_ENV=production

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=<very_long_random_string>
JWT_SECRET=<very_long_random_string>

# Database
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/berlin-benz

# Stripe LIVE keys (not test)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Domain
FRONTEND_URL=https://yourdomain.com
FRONTEND_PAYMENT_URL=https://yourdomain.com/pricing

# Logging
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
```

---

## Deployment Steps

### 1. Update Backend Server.js for Production

```javascript
// Enable HTTPS redirect
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

// Trust proxy (for load balancers)
app.set('trust proxy', 1);
```

### 2. Database Migration

```bash
# If using MongoDB Atlas:
# 1. Create cluster
# 2. Create database user
# 3. Whitelist IP address
# 4. Get connection string
# 5. Update DATABASE_URL in .env

# If using PostgreSQL:
# 1. Create RDS instance
# 2. Create database and user
# 3. Run migrations
# 4. Update DATABASE_URL in .env

# Test connection
npm run test:db
```

### 3. Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

Create `.dockerignore`:

```
node_modules
npm-debug.log
.env
.env.local
.git
.gitignore
```

Deploy:

```bash
# Build
docker build -t berlin-benz-backend:latest .

# Run
docker run -d \
  --name berlin-benz \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=$DATABASE_URL \
  -e STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
  # ... other env vars
  berlin-benz-backend:latest
```

### 4. Heroku Deployment (Alternative)

```bash
# Login
heroku login

# Create app
heroku create berlin-benz-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
heroku config:set DATABASE_URL=mongodb+srv://...

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### 5. Frontend Deployment

```bash
# Build frontend (if using build system)
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod --dir=.

# Or use GitHub Pages + Actions
```

### 6. Stripe Webhook Configuration

```bash
# In Stripe Dashboard:
# 1. Go to Settings → Webhooks
# 2. Add endpoint: https://yourdomain.com/webhooks/stripe
# 3. Select events:
#    - payment_intent.succeeded
#    - payment_intent.payment_failed
#    - payment_intent.canceled
#    - charge.refunded
# 4. Copy webhook secret
# 5. Add to .env: STRIPE_WEBHOOK_SECRET=whsec_...
```

Test webhook:

```bash
# Use Stripe CLI
stripe listen --forward-to localhost:5000/webhooks/stripe

# In another terminal, test
stripe trigger payment_intent.succeeded
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://yourdomain.com/api/health
# Should return:
# {"status":"ok","timestamp":"2024-01-21T...", "environment":"production"}
```

### 2. Test Authentication

```bash
# Signup
curl -X POST https://yourdomain.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test User",
    "email":"test@example.com",
    "password":"TestPass123!@#",
    "confirmPassword":"TestPass123!@#"
  }'

# Should return token
```

### 3. Test Payment Flow

```bash
# 1. Create checkout
curl -X POST https://yourdomain.com/api/payment/create-checkout \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"planId":"starter"}'

# 2. Test with Stripe test card
# Use card: 4242 4242 4242 4242
# Any future exp date, any CVC

# 3. Verify webhook received
# Check logs for: "Payment succeeded"
```

### 4. Test PDF Download

```bash
curl -X GET https://yourdomain.com/api/articles/download/article.pdf \
  -H "Authorization: Bearer {TOKEN}"

# Should download PDF if subscription active
# Should return 403 if no active subscription
```

---

## Monitoring & Alerts

### Set Up Error Tracking

```bash
# Using Sentry
npm install @sentry/node

# In server.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.errorHandler());
```

### Set Up Payment Monitoring

```javascript
// Alert on failed payments
async function handlePaymentFailed(intent) {
  await sendAlert(
    'Payment Failed',
    `User: ${intent.metadata.userId}\nReason: ${intent.last_payment_error.message}`
  );
}
```

### Set Up Daily Reports

```bash
# Cron job at 6 AM daily
0 6 * * * curl -X GET https://yourdomain.com/api/admin/daily-report \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

---

## Scaling Considerations

### Database Optimization

```javascript
// Add indexes for frequently queried fields
db.users.createIndex({ email: 1 });
db.subscriptions.createIndex({ user_id: 1 });
db.subscriptions.createIndex({ status: 1, expires_at: 1 });
db.payments.createIndex({ user_id: 1, created_at: -1 });
```

### Caching

```javascript
// Cache plans (rarely change)
const plansCache = {};
let plansCacheTime = 0;

function getPlans(forceRefresh = false) {
  if (!forceRefresh && plansCacheTime > Date.now() - 3600000) {
    return plansCache;
  }
  // Fetch from DB
  plansCacheTime = Date.now();
  return plansCache;
}
```

### CDN for PDFs

```javascript
// Serve PDFs from CloudFront/Cloudflare
// After authentication, redirect to CDN URL (signed)
const cloudFrontUrl = getSignedCloudFrontUrl(filename);
res.redirect(cloudFrontUrl);
```

---

## Troubleshooting

### Database Connection Fails

```bash
# Check connection string
echo $DATABASE_URL

# Test connection
mongo $DATABASE_URL --eval "db.adminCommand('ping')"

# Check firewall (whitelist server IP)
# Check credentials (user/password correct)
```

### Stripe Webhook Not Receiving

```bash
# 1. Verify endpoint in Stripe Dashboard
# 2. Check webhook secret in .env
# 3. Check server logs for errors
# 4. Stripe CLI: stripe listen --forward-to localhost:5000/webhooks/stripe
```

### High Memory Usage

```bash
# Check for memory leaks
node --inspect server.js

# Profile with Node Inspector
# Check for uncleared intervals/timeouts
# Check database connection pooling
```

### CORS Errors

```bash
# Verify FRONTEND_URL matches exactly
# Check credentials: true is set
# Check allowed headers match frontend requests
```

---

## Security Checklist (Production)

- [ ] HTTPS enabled, HTTP → HTTPS redirect
- [ ] Security headers (CSP, HSTS, X-Frame-Options)
- [ ] Rate limiting active on auth endpoints
- [ ] CORS restricted to production domain
- [ ] No stack traces in error responses
- [ ] Passwords never logged
- [ ] API keys/secrets in environment only
- [ ] Database backups encrypted
- [ ] Audit logs retained (90+ days)
- [ ] Monitoring/alerting configured
- [ ] Intrusion detection enabled
- [ ] Secrets rotated regularly

---

## Maintenance

### Weekly
- [ ] Check error logs for patterns
- [ ] Review Stripe webhook deliveries
- [ ] Check database size growth

### Monthly
- [ ] Review audit logs
- [ ] Check for unused subscriptions
- [ ] Security patch updates
- [ ] Database optimization

### Quarterly
- [ ] Penetration testing
- [ ] Review access controls
- [ ] Update security documentation
- [ ] Capacity planning

---

## Rollback Procedure

If production deployment fails:

```bash
# 1. Identify last working version
git log --oneline | head -5

# 2. Revert
git revert <commit-hash>
git push heroku main

# 3. Or restore from backup
# Database: restore from backup
# Code: git checkout <tag>

# 4. Verify
curl https://yourdomain.com/api/health
```

---

## Support

For issues:

1. Check logs: `heroku logs --tail`
2. Test locally: `npm run dev`
3. Stripe dashboard: Check webhook deliveries
4. Database: Check connection and slow queries
5. Monitoring service: Check error reports
