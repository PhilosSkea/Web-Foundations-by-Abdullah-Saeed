# Berlin-Benz Backend API

This is the backend server for the Berlin-Benz website, handling authentication and payment processing.

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Update the `.env` file with:
- `JWT_SECRET`: A secure random string for JWT signing
- `STRIPE_SECRET_KEY`: Your Stripe secret API key (from https://dashboard.stripe.com)
- `FRONTEND_URL`: The URL where your frontend is running (default: http://localhost:3000)

### 3. Run the Backend Server
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The backend will be available at `http://localhost:5000`

## API Endpoints

### Authentication Routes (`/api/auth`)

**POST /signup**
- Register a new user
- Body: `{ email, password, confirmPassword, name }`
- Returns: `{ token, user }`

**POST /login**
- Login an existing user
- Body: `{ email, password }`
- Returns: `{ token, user }`

**POST /verify**
- Verify if a token is valid
- Headers: `Authorization: Bearer <token>`
- Returns: `{ message, userId }`

**POST /logout**
- Logout (clears server-side session if implemented)
- Headers: `Authorization: Bearer <token>`
- Returns: `{ message }`

### Payment Routes (`/api/payment`)

**POST /create-intent**
- Create a Stripe payment intent
- Headers: `Authorization: Bearer <token>`
- Body: `{ amount, currency (optional), description }`
- Returns: `{ clientSecret, paymentIntentId }`

**POST /confirm-payment**
- Confirm and record a payment
- Headers: `Authorization: Bearer <token>`
- Body: `{ paymentIntentId, paymentMethodId, amount, currency, description }`
- Returns: `{ message, paymentIntentId }`

**GET /history**
- Get user's payment history
- Headers: `Authorization: Bearer <token>`
- Returns: `{ payments }`

## Database

Currently uses in-memory storage. To use a real database:
1. Install a database driver (e.g., `npm install mongoose` for MongoDB or `npm install pg` for PostgreSQL)
2. Update `backend/config/database.js` with your database connection logic
3. Implement proper data models in `backend/models/`

## Security Considerations

- Store JWT_SECRET securely (use environment variables)
- Use HTTPS in production
- Implement rate limiting for login attempts
- Use strong password requirements
- Keep dependencies updated
- Add input validation for all endpoints
- Implement CORS properly for your frontend URL

## Deployment

When deploying to production:
1. Set `NODE_ENV=production`
2. Use a real database (not in-memory)
3. Configure proper CORS settings with your production frontend URL
4. Use environment variables for all sensitive data
5. Enable HTTPS/SSL
6. Consider using a process manager like PM2
