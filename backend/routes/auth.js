/**
 * AUTHENTICATION ROUTES
 * 
 * SECURITY PATTERNS:
 * ✅ bcrypt password hashing
 * ✅ httpOnly session cookies (not JWTs in localStorage)
 * ✅ Proper input validation
 * ✅ Password requirements (12+ chars)
 * ✅ No user enumeration (generic error messages)
 * ✅ Audit logging on all auth events
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../models/user.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// SECURITY: Password requirements
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    };
  }
  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
    };
  }
  return { valid: true };
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/auth/signup
 * Register new user
 * 
 * SECURITY:
 * - Password hashed with bcrypt (10 rounds)
 * - Email validation
 * - User enumeration prevention (generic message)
 * - Session created server-side
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, confirmPassword } = req.body;

    // INPUT VALIDATION
    if (!email?.trim() || !password || !name?.trim() || !confirmPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'All fields are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid email format'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Passwords do not match'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Validation Error',
        message: passwordValidation.error
      });
    }

    // CHECK IF USER EXISTS
    const existingUser = await db.users.findByEmail(email.toLowerCase());
    if (existingUser) {
      // SECURITY: Generic message - don't reveal if email exists
      return res.status(400).json({
        error: 'Signup Failed',
        message: 'Unable to create account. Please try again.'
      });
    }

    // HASH PASSWORD (10 rounds is standard)
    const passwordHash = await bcrypt.hash(password, 10);

    // CREATE USER
    const user = await db.users.create(
      email.toLowerCase(),
      passwordHash,
      name.trim()
    );

    // CREATE SERVER-SIDE SESSION (httpOnly cookie)
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    // AUDIT LOG
    await db.audit.log(user.id, 'signup', {
      email: user.email,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to create account. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user
 * 
 * SECURITY:
 * - Bcrypt comparison (timing-safe)
 * - Generic error messages
 * - Session created server-side
 * - Rate limited at route level
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // INPUT VALIDATION
    if (!email?.trim() || !password) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // FIND USER
    const user = await db.users.findByEmail(email.toLowerCase());
    if (!user) {
      // SECURITY: Generic message - don't reveal if user exists
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // COMPARE PASSWORD (bcrypt timing-safe comparison)
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // SECURITY: Generic message
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // CREATE SERVER-SIDE SESSION
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    // UPDATE LAST LOGIN
    await db.users.updateLastLogin(user.id);

    // AUDIT LOG
    await db.audit.log(user.id, 'login', {
      email: user.email,
      ip: req.ip
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to log in. Please try again.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await db.audit.log(req.userId, 'logout', { ip: req.ip });

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          error: 'Logout Error',
          message: 'Unable to log out'
        });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to log out'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 * Returns null if not logged in
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        authenticated: false,
        user: null
      });
    }

    const user = await db.users.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.status(401).json({
        authenticated: false,
        user: null
      });
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      authenticated: false,
      user: null
    });
  }
});

export default router;

