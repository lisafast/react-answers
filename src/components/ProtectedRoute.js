import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthService from '../services/AuthService.js';
import { useTranslations } from '../hooks/useTranslations.js';

const ProtectedRoute = ({ children, lang = 'en' }) => {
  const location = useLocation();
  useTranslations(lang); // initialize translations
  
  if (!AuthService.isAuthenticated()) {
    // Redirect to login page with return url
    return <Navigate to={`/${lang}/login`} state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;