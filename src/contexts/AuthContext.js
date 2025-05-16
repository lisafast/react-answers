import React, { createContext, useContext, useState, useEffect } from 'react';
import AuthService from '../services/AuthService.js';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load user from localStorage on initial render
    const user = AuthService.getUser();
    setCurrentUser(user);
    setLoading(false);
  }, []);
    // Update context when user logs in or out
  const login = async (email, password) => {
    try {
      setLoading(true);
      const data = await AuthService.login(email, password);
      // Update the user state
      await Promise.resolve(setCurrentUser(data.user));
      return {
        user: data.user,
        defaultRoute: getDefaultRouteForRole(data.user.role)
      };
    } finally {
      setLoading(false);
    }
  };
  
  const signup = async (email, password) => {
    try {
      setLoading(true);
      const data = await AuthService.signup(email, password);
      setCurrentUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };
  
  const logout = () => {
    setLoading(true);
    AuthService.logout();
    setCurrentUser(null);
    setLoading(false);
  };
  
  // Helper methods for role checking
  const isAdmin = () => {
    return currentUser?.role === 'admin';
  };
  
  const isPartner = () => {
    return currentUser?.role === 'partner';
  };
  
  const hasRole = (role) => {
    return currentUser?.role === role;
  };

  const getDefaultRouteForRole = (role, lang = 'en') => {
    const prefix = lang === 'fr' ? '/fr' : '/en';
    switch (role) {
      case 'admin':
        return `${prefix}/admin`;
      case 'partner':
        return `${prefix}/`;
      default:
        return prefix;
    }
  };

  const value = {
    currentUser,
    loading,
    login,
    signup,
    logout,
    isAdmin,
    isPartner,
    hasRole,
    getDefaultRouteForRole
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
