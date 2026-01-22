// Simulated in-memory database (replace with real database like MongoDB/PostgreSQL)
const users = {};
const payments = [];

module.exports = {
  users,
  payments,
  
  // User operations
  findUserByEmail(email) {
    return users[email];
  },
  
  createUser(email, hashedPassword, name) {
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date()
    };
    users[email] = user;
    return user;
  },
  
  // Payment operations
  savePayment(paymentData) {
    payments.push({
      id: Date.now().toString(),
      ...paymentData,
      createdAt: new Date()
    });
  },
  
  getPaymentsByUser(userId) {
    return payments.filter(p => p.userId === userId);
  }
};
