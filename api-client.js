/**
 * API Client Utility
 * Simplifies API calls to the backend with automatic token handling
 */

const API_BASE_URL = 'http://localhost:5000/api';

class APIClient {
  static getToken() {
    return localStorage.getItem('authToken');
  }

  static setToken(token) {
    localStorage.setItem('authToken', token);
  }

  static clearToken() {
    localStorage.removeItem('authToken');
  }

  static getHeaders(contentType = 'application/json') {
    const headers = {
      'Content-Type': contentType
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(options.contentType || 'application/json'),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'An error occurred',
          data
        };
      }

      return data;
    } catch (error) {
      if (error.status === 401) {
        // Token expired or invalid
        this.clearToken();
        window.location.href = 'login.html';
      }
      throw error;
    }
  }

  // Authentication methods
  static async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (data.token) {
      this.setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  }

  static async signup(email, password, name, confirmPassword) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, confirmPassword })
    });
    
    if (data.token) {
      this.setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  }

  static async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
      localStorage.removeItem('user');
    }
  }

  static async verifyToken() {
    return this.request('/auth/verify', {
      method: 'POST'
    });
  }

  // Payment methods
  static async createPaymentIntent(amount, currency = 'usd', description = '') {
    return this.request('/payment/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, currency, description })
    });
  }

  static async confirmPayment(paymentIntentId, paymentMethodId, amount, currency, description) {
    return this.request('/payment/confirm-payment', {
      method: 'POST',
      body: JSON.stringify({
        paymentIntentId,
        paymentMethodId,
        amount,
        currency,
        description
      })
    });
  }

  static async getPaymentHistory() {
    return this.request('/payment/history', {
      method: 'GET'
    });
  }

  // Utility method to check if user is authenticated
  static isAuthenticated() {
    return !!this.getToken();
  }

  // Get user from localStorage
  static getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIClient;
}
