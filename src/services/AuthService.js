import { getApiUrl } from '../utils/apiToUrl.js';


class AuthService {
  static setToken(token) {
    localStorage.setItem('token', token);
  }

  static getToken() {
    return localStorage.getItem('token');
  }

  static setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  static getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  static removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  static isAuthenticated() {
    const token = this.getToken();
    const user = this.getUser();
    
    // First check if token exists and user is active
    if (!token || !user || !user.active) {
      return false;
    }
    
    // Check if token is expired
    if (this.isTokenExpired()) {
      this.logout();
      return false;
    }
    
    return true;
  }

  static isTokenExpired() {
    const token = this.getToken();
    if (!token) {
      return true;
    }
    
    try {
      // JWT tokens are in format: header.payload.signature
      // We need to decode the payload to check expiration
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      
      // Check if exp field exists and token is expired
      if (decoded.exp) {
        const currentTime = Date.now() / 1000;
        return decoded.exp < currentTime;
      }
      return false;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // If there's an error parsing, assume token is invalid
    }
  }

  static isAdmin() {
    const user = this.getUser();
    return !!user && user.role === 'admin';
  }

  static async signup(email, password) {
    const response = await fetch(getApiUrl('db-auth-signup'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Signup failed');
    }

    const data = await response.json();
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  }

  static async login(email, password) {
    const response = await fetch(getApiUrl('db-auth-login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  }

  static logout() {
    // Clear authentication data
    this.removeToken();
    
    // Determine the current language from URL or default to English
    let language = 'en';
    const pathname = window.location.pathname;
    
    // Check if current path contains French indicator
    if (pathname.includes('/fr/')) {
      language = 'fr';
    }
    
    // Redirect to the language-specific login page
    window.location.href = `/${language}/login`;
  }

  static getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  static async fetchWithAuth(url, options = {}) {
    const headers = { ...this.getAuthHeader(), ...options.headers };
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      this.logout(); // Redirect to login if token is invalid
    }

    return response;
  }

  // Setup a method to check auth status that can be called periodically
  static setupAuthExpirationChecker() {
    // Check token validity every minute - handles the scenario where a user
    // stays on the same page for a long time without navigating to a new route.
    // This ensures users are logged out even if they're inactive.
    const intervalId = setInterval(() => {
      if (this.isTokenExpired()) {
        this.logout();
        clearInterval(intervalId);
      }
    }, 60000);
    
    // Also set up an interceptor for 401 responses - this handles API calls
    // that fail due to expired tokens during normal application usage
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // If we get a 401 (Unauthorized) error, automatically redirect to login
        if (response.status === 401) {
          console.log('Authentication failed with 401 response - redirecting to login');
          this.logout();
        }
        return response;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    };
    
    return intervalId;
  }
}

export default AuthService;