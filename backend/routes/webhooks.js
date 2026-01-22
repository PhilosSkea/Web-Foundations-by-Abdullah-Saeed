/**
 * PAYONEER WEBHOOK HANDLER (IPN)
 * 
 * THIS IS THE MOST CRITICAL SECURITY COMPONENT
 * 
 * RESPONSIBILITY: Only grant access after Payoneer confirms payment
 * 
 * Why IPN webhooks?
 * - Frontend payment confirmation is UNTRUSTWORTHY
 * - Payoneer is the source of truth
 * - IPN notifications are server-to-server and verified
 * - Prevents fraudsters from claiming payment without paying
 * 
 * SECURITY:
 * ✅ IPN signature verification (HMAC-SHA256)
 * ✅ Verify amount matches plan price
 * ✅ Idempotent processing (handle duplicate IPN calls)
 * ✅ Only grant access on confirmed payment
 * ✅ Detailed audit logging
 */

import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { db } from '../models/user.js';
import { getPlan } from '../config/plans.js';

const router = express.Router();

/**
 * Verify Payoneer IPN Signature
 * Uses HMAC-SHA256 signature verification
 */
function verifyPayoneerSignature(ipnData, signature) {
  if (!signature) return false;

  // Create string to hash (all IPN data in specific order)
  const secret = process.env.PAYONEER_IPN_SECRET;
  const dataToHash = JSON.stringify(ipnData);
  
  // Calculate HMAC-SHA256
  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToHash)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

/**
 * GRANT ACCESS: Handle Payment Succeeded
 * 
 * This is where subscriptions are created!
 * User gets access ONLY here, nowhere else.
 */
async function handlePaymentSucceeded(ipnData) {
  const {
    custom_param1: userId,
    custom_param2: planId,
    custom_param3: planName,
    token: paymentToken,
    amount,
    status
  } = ipnData;

  console.log(`✅ Payment succeeded: ${paymentToken} for user ${userId}`);

  // Validate required data
  if (!userId || !planId || !amount) {
    console.error('❌ Missing IPN data:', { userId, planId, amount });
    return;
  }

  // FIND EXISTING PAYMENT RECORD
  let payment = await db.payments.findByStripeId(paymentToken);

  // Idempotency: If already processed, skip
  if (payment && payment.status === 'completed') {
    console.log(`⚠️ IPN already processed for ${paymentToken}`);
    return;
  }

  // SECURITY: Verify amount matches plan price
  const plan = getPlan(planId);
  if (!plan) {
    console.error(`❌ Plan not found: ${planId}`);
    await db.audit.log(userId, 'invalid_plan', { planId, paymentToken });
    return;
  }

  // Convert amount to cents for comparison
  const amountInCents = Math.round(parseFloat(amount) * 100);
  if (amountInCents !== plan.price) {
    console.error(
      `❌ FRAUD DETECTED: Amount ${amountInCents}¢ doesn't match plan ${planId} (${plan.price}¢)`
    );
    await db.audit.log(userId, 'fraud_detected', {
      paymentToken,
      expectedAmount: plan.price,
      actualAmount: amountInCents,
      planId
    });
    return;
  }

  // CREATE SUBSCRIPTION
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

  const subscription = await db.subscriptions.create(
    userId,
    planId,
    paymentToken,
    expiresAt
  );

  // UPDATE PAYMENT STATUS
  if (payment) {
    await db.payments.updateStatus(payment.id, 'completed');
  }

  // AUDIT LOG
  await db.audit.log(userId, 'subscription_created', {
    paymentToken,
    planId,
    amount: amountInCents,
    expiresAt,
    subscriptionId: subscription.id
  });

  console.log(
    `🎉 Subscription created: User ${userId} → Plan ${planId} (expires ${expiresAt})`
  );
}

/**
 * Handle Payment Failed
 * User sees "payment failed" message
 */
async function handlePaymentFailed(ipnData) {
  const { custom_param1: userId, token: paymentToken, error_message } = ipnData;

  console.log(`❌ Payment failed: ${paymentToken}`);

  let payment = await db.payments.findByStripeId(paymentToken);
  if (payment) {
    await db.payments.updateStatus(payment.id, 'failed');
  }

  await db.audit.log(userId, 'payment_failed', {
    paymentToken,
    reason: error_message
  });
}

/**
 * Handle Payment Pending
 * Payment is still being processed
 */
async function handlePaymentPending(ipnData) {
  const { custom_param1: userId, token: paymentToken } = ipnData;

  console.log(`⏳ Payment pending: ${paymentToken}`);

  await db.audit.log(userId, 'payment_pending', { paymentToken });
}

/**
 * Handle Payment Refunded
 * User requested refund (you initiated it)
 * Cancel their subscription
 */
async function handlePaymentRefunded(ipnData) {
  const { custom_param1: userId, custom_param2: planId, token: paymentToken } =
    ipnData;

  console.log(`🔄 Payment refunded: ${paymentToken}`);

  // Find and cancel subscription
  const subscriptions = await db.subscriptions.findByUserId(userId);
  const subscription = subscriptions.find((s) => s.plan_id === planId);

  if (subscription) {
    await db.subscriptions.updateStatus(subscription.id, 'canceled');
  }

  // Update payment status
  let payment = await db.payments.findByStripeId(paymentToken);
  if (payment) {
    await db.payments.updateStatus(payment.id, 'refunded');
  }

  await db.audit.log(userId, 'payment_refunded', {
    paymentToken,
    planId,
    subscriptionId: subscription?.id
  });

  console.log(`✅ Subscription canceled for user ${userId}`);
}

/**
 * POST /webhooks/payoneer
 * Handle Payoneer IPN notifications
 * 
 * SECURITY: Payoneer signs IPN with HMAC-SHA256.
 * We verify signature to ensure authenticity.
 */
router.post('/', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    // SECURITY: Verify IPN signature
    const ipnData = req.body;
    const signature = req.headers['x-payoneer-signature'];

    if (!verifyPayoneerSignature(ipnData, signature)) {
      console.error('❌ IPN signature verification failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Log IPN event
    console.log(`✅ IPN Event: ${ipnData.action} | Status: ${ipnData.status}`);

    // Route to appropriate handler based on status
    switch (ipnData.status) {
      case 'success':
      case 'approved':
        await handlePaymentSucceeded(ipnData);
        break;
      case 'failed':
      case 'declined':
        await handlePaymentFailed(ipnData);
        break;
      case 'pending':
        await handlePaymentPending(ipnData);
        break;
      case 'refund':
        await handlePaymentRefunded(ipnData);
        break;
      default:
        console.warn(`⚠️ Unknown IPN status: ${ipnData.status}`);
    }

    // Always respond 200 OK to Payoneer
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ IPN processing error:', error);
    // Still respond 200 to Payoneer so it doesn't retry
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;
