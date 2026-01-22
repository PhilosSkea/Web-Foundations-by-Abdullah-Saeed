/**
 * Database Models - In-Memory Implementation
 * 
 * Replace with MongoDB/PostgreSQL in production.
 * This is for development only.
 * 
 * SCHEMA:
 * Users: { id, email, password_hash, name, created_at }
 * Subscriptions: { id, user_id, plan_id, stripe_subscription_id, status, expires_at }
 * Payments: { id, user_id, stripe_payment_intent_id, amount, status, plan_id, created_at }
 * AuditLog: { id, user_id, action, details, created_at }
 */

const users = new Map();
const subscriptions = new Map();
const payments = new Map();
const auditLog = [];

export const db = {
  // USER OPERATIONS
  users: {
    async create(email, passwordHash, name) {
      const id = Math.random().toString(36).substring(7);
      const user = {
        id,
        email,
        password_hash: passwordHash,
        name,
        created_at: new Date(),
        updated_at: new Date()
      };
      users.set(email, user);
      return user;
    },

    async findByEmail(email) {
      return users.get(email) || null;
    },

    async findById(id) {
      for (const user of users.values()) {
        if (user.id === id) return user;
      }
      return null;
    },

    async updateLastLogin(userId) {
      for (const user of users.values()) {
        if (user.id === userId) {
          user.last_login = new Date();
          return user;
        }
      }
    }
  },

  // SUBSCRIPTION OPERATIONS
  subscriptions: {
    async create(userId, planId, stripeSubscriptionId, expiresAt) {
      const id = Math.random().toString(36).substring(7);
      const subscription = {
        id,
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: stripeSubscriptionId,
        status: 'active',
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      };
      subscriptions.set(id, subscription);
      return subscription;
    },

    async findByUserId(userId) {
      const userSubs = [];
      for (const sub of subscriptions.values()) {
        if (sub.user_id === userId) {
          userSubs.push(sub);
        }
      }
      return userSubs;
    },

    async findActiveByUserId(userId) {
      const subs = await db.subscriptions.findByUserId(userId);
      return subs.filter(
        sub => sub.status === 'active' && new Date(sub.expires_at) > new Date()
      );
    },

    async findByStripeId(stripeSubscriptionId) {
      for (const sub of subscriptions.values()) {
        if (sub.stripe_subscription_id === stripeSubscriptionId) {
          return sub;
        }
      }
      return null;
    },

    async updateStatus(subscriptionId, status) {
      const sub = subscriptions.get(subscriptionId);
      if (sub) {
        sub.status = status;
        sub.updated_at = new Date();
        return sub;
      }
      return null;
    },

    async cancel(subscriptionId) {
      const sub = subscriptions.get(subscriptionId);
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelled_at = new Date();
        return sub;
      }
      return null;
    }
  },

  // PAYMENT OPERATIONS
  payments: {
    async create(userId, planId, stripePaymentIntentId, amount) {
      const id = Math.random().toString(36).substring(7);
      const payment = {
        id,
        user_id: userId,
        plan_id: planId,
        stripe_payment_intent_id: stripePaymentIntentId,
        amount,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };
      payments.set(id, payment);
      return payment;
    },

    async findByStripeId(stripePaymentIntentId) {
      for (const payment of payments.values()) {
        if (payment.stripe_payment_intent_id === stripePaymentIntentId) {
          return payment;
        }
      }
      return null;
    },

    async updateStatus(paymentId, status) {
      const payment = payments.get(paymentId);
      if (payment) {
        payment.status = status;
        payment.updated_at = new Date();
        return payment;
      }
      return null;
    },

    async findByUserId(userId) {
      const userPayments = [];
      for (const payment of payments.values()) {
        if (payment.user_id === userId) {
          userPayments.push(payment);
        }
      }
      return userPayments.sort((a, b) => b.created_at - a.created_at);
    }
  },

  // AUDIT LOGGING
  audit: {
    async log(userId, action, details = {}) {
      auditLog.push({
        id: Math.random().toString(36).substring(7),
        user_id: userId,
        action,
        details,
        ip: details.ip || 'unknown',
        timestamp: new Date()
      });
    },

    async getByUserId(userId, limit = 50) {
      return auditLog
        .filter(log => log.user_id === userId)
        .reverse()
        .slice(0, limit);
    }
  }
};

export default db;
