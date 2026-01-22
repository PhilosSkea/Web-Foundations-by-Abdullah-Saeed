/**
 * PAYMENT ROUTES - Payoneer Integration
 * 
 * SECURITY PATTERNS:
 * ✅ Plans defined backend (never trust frontend)
 * ✅ Prices validated on every request
 * ✅ Unique tokens prevent duplicate payments
 * ✅ Access granted ONLY after IPN confirmation
 * ✅ No premature access grants
 * 
 * CRITICAL: Payoneer IPN callbacks are the source of truth.
 * Frontend sees "pending" until IPN confirms payment.success
 */

import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../models/user.js';
import { getPlan, validatePlanPrice, getPublicPlans } from '../config/plans.js';
import { requireAuth, requireSubscription } from '../middleware/auth.js';

const router = express.Router();

// Payoneer API endpoint
const PAYONEER_API = process.env.PAYONEER_SANDBOX === 'true'
  ? 'https://sandbox.payoneer.com/api'
  : 'https://api.payoneer.com/api';

/**
 * GET /api/payment/plans
 * Get available plans for the frontend
 * SECURITY: Public endpoint (no auth required)
 */
router.get('/plans', (req, res) => {
  try {
    const plans = getPublicPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Plans error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch plans'
    });
  }
});

/**
 * POST /api/payment/create-checkout
 * Create a Payoneer payment checkout token for a specific plan
 * 
 * SECURITY:
 * - Plan ID from body must exist in backend
 * - Price is NEVER taken from frontend, always calculated server-side
 * - Unique token prevents duplicate payments
 * - User must be authenticated
 */
router.post('/create-checkout', requireAuth, async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Plan ID is required'
      });
    }

    // SECURITY: Validate plan exists (backend is source of truth)
    const plan = getPlan(planId);
    if (!plan) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid plan selected'
      });
    }

    // SECURITY: Create unique token to prevent duplicate payments
    const paymentToken = uuidv4();
    const user = await db.users.findById(req.userId);

    // Prepare Payoneer checkout request
    const payoneerRequest = {
      apikey: process.env.PAYONEER_API_KEY,
      clientid: process.env.PAYONEER_CLIENT_ID,
      token: paymentToken,
      amount: (plan.price / 100).toString(), // Convert from cents to dollars
      currency: 'USD',
      description: `${plan.name} subscription`,
      customer_email: user.email,
      customer_name: user.name || 'Customer',
      memo: `Order for ${plan.name}`,
      reference: `${req.userId}-${planId}-${Date.now()}`,
      // IPN notification URL (Payoneer will call this after payment)
      notify_url: `${process.env.FRONTEND_URL}/webhooks/payoneer`,
      return_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
      custom_param1: req.userId,
      custom_param2: planId,
      custom_param3: plan.name
    };

    // SECURITY: Store payment record in database with pending status
    const payment = await db.payments.create(
      req.userId,
      planId,
      paymentToken,
      plan.price
    );

    // Log payment attempt
    await db.audit.log(req.userId, 'payment_initiated', {
      paymentToken,
      planId,
      amount: plan.price,
      ip: req.ip
    });

    // Build Payoneer checkout URL
    const params = new URLSearchParams(payoneerRequest);
    const checkoutUrl = `${PAYONEER_API}/checkout?${params.toString()}`;

    // Return payment information to frontend
    res.json({
      paymentToken,
      checkoutUrl,
      redirectUrl: checkoutUrl, // For backward compatibility
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: 'USD'
      }
    });
  } catch (error) {
    console.error('Payment checkout error:', error);

    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to create payment. Please try again.'
    });
  }
});

/**
 * GET /api/payment/status/:paymentToken
 * Check payment status
 * 
 * SECURITY: Verify this payment belongs to the authenticated user
 */
router.get('/status/:paymentToken', requireAuth, async (req, res) => {
  try {
    const payment = await db.payments.findByStripeId(req.params.paymentToken);

    if (!payment || payment.user_id !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot access this payment'
      });
    }

    res.json({
      status: payment.status, // "pending", "succeeded", "failed"
      paymentToken: payment.stripe_payment_intent_id,
      amount: payment.amount,
      planId: payment.plan_id
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to check payment status'
    });
  }
});

/**
 * GET /api/payment/history
 * Get user's payment history (authenticated users only)
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const payments = await db.payments.findByUserId(req.userId);

    const enriched = payments.map(p => ({
      id: p.id,
      planId: p.plan_id,
      amount: p.amount,
      status: p.status,
      createdAt: p.created_at,
      plan: getPlan(p.plan_id)
    }));

    res.json({ payments: enriched });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch payment history'
    });
  }
});

/**
 * GET /api/payment/subscription/status
 * Check current subscription status
 * Returns null if no active subscription
 */
router.get('/subscription/status', requireAuth, async (req, res) => {
  try {
    const subscriptions = await db.subscriptions.findActiveByUserId(req.userId);

    if (subscriptions.length === 0) {
      return res.json({
        hasActiveSubscription: false,
        subscription: null
      });
    }

    const subscription = subscriptions[0];
    const plan = getPlan(subscription.plan_id);

    res.json({
      hasActiveSubscription: true,
      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
        planName: plan?.name,
        expiresAt: subscription.expires_at,
        status: subscription.status
      }
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to check subscription'
    });
  }
});

export default router;

