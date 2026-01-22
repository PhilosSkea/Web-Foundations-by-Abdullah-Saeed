/**
 * Subscription Plans Configuration
 * Backend is the single source of truth for pricing and features
 * 
 * SECURITY: Never trust client-sent pricing. Always validate here.
 */

export const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: '10 articles per month',
    price: 9800, // Cents ($98.00)
    currency: 'usd',
    articles_limit: 10,
    duration_days: 30,
    features: [
      '10 articles per month',
      'Access to text articles',
      'Email support'
    ]
  },
  
  professional: {
    id: 'professional',
    name: 'Professional',
    description: '50 articles per month',
    price: 49800, // Cents ($498.00)
    currency: 'usd',
    articles_limit: 50,
    duration_days: 30,
    features: [
      '50 articles per month',
      'Access to all article types (text, image, PDF)',
      'Priority email support',
      'Downloadable PDFs'
    ]
  },
  
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited Annual',
    description: 'Unlimited articles for 1 year',
    price: 99800, // Cents ($998.00)
    currency: 'usd',
    articles_limit: -1, // Unlimited
    duration_days: 365,
    features: [
      'Unlimited articles',
      'All article types',
      'Priority phone & email support',
      'Early access to new articles',
      'Batch downloads',
      'API access'
    ]
  }
};

/**
 * Validate that a plan exists and return it
 * @param {string} planId - The plan ID requested
 * @returns {Object} Plan object or null
 */
export function getPlan(planId) {
  return SUBSCRIPTION_PLANS[planId] || null;
}

/**
 * Get all available plans for frontend
 * Returns only public information (price, features, etc.)
 * @returns {Array}
 */
export function getPublicPlans() {
  return Object.values(SUBSCRIPTION_PLANS).map(plan => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    features: plan.features,
    duration_days: plan.duration_days
  }));
}

/**
 * Verify that the payment amount matches the plan
 * SECURITY: Called on server after payment to prevent fraud
 * @param {string} planId
 * @param {number} amountCents - Amount customer was charged
 * @returns {boolean}
 */
export function validatePlanPrice(planId, amountCents) {
  const plan = getPlan(planId);
  if (!plan) return false;
  
  // Allow 1 cent tolerance for rounding
  return Math.abs(plan.price - amountCents) <= 1;
}

export default SUBSCRIPTION_PLANS;
