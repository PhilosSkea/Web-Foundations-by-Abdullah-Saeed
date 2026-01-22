# Quick Start Guide

## Project Structure
```
web-foundations/
├── index.html                 # Entry point - redirects to login/home
├── login.html                 # Login & signup page
├── home.html                  # Protected home page
├── about.html                 # About page
├── contact.html               # Contact page
├── pricing.html               # Pricing page
├── api-client.js              # Frontend API client utility
├── script.js                  # Frontend JavaScript
├── style.css                  # Styles
├── images/                    # Image assets
├── pdfs/                      # PDF assets
└── backend/                   # Node.js backend server
    ├── server.js              # Express server entry point
    ├── package.json           # Dependencies
    ├── .env.example           # Environment template
    ├── .gitignore             # Git ignore rules
    ├── README.md              # Backend documentation
    ├── config/
    │   └── database.js        # Database layer (in-memory)
    ├── middleware/
    │   └── auth.js            # JWT verification middleware
    └── routes/
        ├── auth.js            # Authentication endpoints
        └── payment.js         # Payment endpoints
```

## Setup & Running

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your JWT_SECRET and STRIPE_SECRET_KEY
npm start
```

Backend will run on `http://localhost:5000`

### 2. Frontend
Simply open `index.html` in your browser or serve it with a simple HTTP server:
```bash
# If you have Python installed:
python -m http.server 3000

# Or with Node.js http-server:
npm install -g http-server
http-server -p 3000
```

Frontend will be available at `http://localhost:3000`

## Testing the System

### 1. Test Login Flow
1. Open `http://localhost:3000` (or your frontend URL)
2. You should be redirected to `login.html`
3. Try signing up:
   - Name: John Doe
   - Email: john@example.com
   - Password: password123
   - Confirm Password: password123
4. You should be redirected to `home.html`
5. Click "Logout" to return to login

### 2. Test API Calls Directly
```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Verify token (replace TOKEN_HERE with actual token from login response)
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer TOKEN_HERE"
```

## Using the API Client

The `api-client.js` file provides a simple class to handle all API calls:

```javascript
// Login
try {
  await APIClient.login('user@example.com', 'password123');
  // Token is automatically stored
} catch (error) {
  console.error(error.message);
}

// Signup
try {
  await APIClient.signup('user@example.com', 'password123', 'John Doe', 'password123');
} catch (error) {
  console.error(error.message);
}

// Check if authenticated
if (APIClient.isAuthenticated()) {
  // User is logged in
}

// Get user info
const user = APIClient.getUser();
console.log(user.name, user.email);

// Payment
try {
  const intent = await APIClient.createPaymentIntent(100, 'usd', 'Article purchase');
  console.log(intent.clientSecret);
} catch (error) {
  console.error(error.message);
}

// Logout
await APIClient.logout();
```

## Next Steps

### Adding More Pages
To add protected pages (like pricing with payment):
1. Include `api-client.js` in the page
2. Add auth check at the top:
   ```javascript
   if (!APIClient.isAuthenticated()) {
     window.location.href = 'login.html';
   }
   ```

### Database Integration
Currently uses in-memory storage (data resets on server restart). To use a real database:

1. **MongoDB**
   ```bash
   npm install mongoose
   # Update backend/config/database.js to use Mongoose
   ```

2. **PostgreSQL**
   ```bash
   npm install pg
   # Update backend/config/database.js with postgres connection
   ```

### Payment Integration
To use real Stripe payments:
1. Get API keys from https://dashboard.stripe.com
2. Add STRIPE_SECRET_KEY to `.env`
3. Install Stripe on frontend: `<script src="https://js.stripe.com/v3/"></script>`
4. Create payment forms on your pages using Stripe Elements

## Common Issues

### "Cannot find module" error
Make sure you ran `npm install` in the backend folder

### "CORS error" when login doesn't work
Make sure backend is running on `http://localhost:5000` and FRONTEND_URL in `.env` matches your frontend URL

### Token issues
- Tokens expire after 24 hours (set in `/backend/routes/auth.js`)
- Expired tokens automatically redirect to login
- Clear localStorage if you want to force logout

### Data not persisting
Currently using in-memory database. Restart the server and data is lost. Use real database for persistent data.

## Production Checklist

Before deploying:
- [ ] Set up real database (MongoDB/PostgreSQL)
- [ ] Use HTTPS with valid SSL certificate
- [ ] Set strong `JWT_SECRET` in environment
- [ ] Configure CORS for production domain
- [ ] Use production Stripe API keys
- [ ] Set `NODE_ENV=production`
- [ ] Use process manager (PM2) for backend
- [ ] Set up monitoring/logging
- [ ] Configure rate limiting
- [ ] Enable CSRF protection if needed
