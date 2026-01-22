/**
 * Authentication Middleware
 * 
 * SECURITY PATTERN: httpOnly session cookies
 * - Tokens never exposed to frontend JS
 * - Cookies auto-sent by browser, can't be stolen via XSS
 * - Session validated server-side on every request
 */

export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please log in to continue'
    });
  }

  req.userId = req.session.userId;
  req.userEmail = req.session.userEmail;
  next();
};

/**
 * Optional auth - doesn't fail if not authenticated
 */
export const optionalAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    req.userEmail = req.session.userEmail;
  }
  next();
};

/**
 * SECURITY: Verify user has active subscription
 * Always check against database, never trust client
 */
export const requireSubscription = async (req, res, next) => {
  const { db } = await import('../models/user.js');
  
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const subscriptions = await db.subscriptions.findActiveByUserId(req.userId);
  
  if (subscriptions.length === 0) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Active subscription required'
    });
  }

  req.subscription = subscriptions[0];
  next();
};

/**
 * Rate limiting check (applied at route level)
 */
export const rateLimitExceeded = (req, res) => {
  res.status(429).json({
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: req.rateLimit.resetTime
  });
};

