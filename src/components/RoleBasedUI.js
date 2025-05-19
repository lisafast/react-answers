import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';

// Component to render content only for specific roles
export const RoleBasedContent = ({ 
  roles = [], // Array of allowed roles
  children, 
  fallback = null // Content to show if user doesn't have required role
}) => {
  const { currentUser } = useAuth();
  
  // If no roles are specified, show to everyone who is authenticated
  if (roles.length === 0 && currentUser) {
    return <>{children}</>;
  }
  
  // If user has one of the specified roles, show the content
  if (currentUser && roles.includes(currentUser.role)) {
    return <>{children}</>;
  }
  
  // Otherwise, show the fallback (if provided)
  return fallback;
};

// Component to render content only for admins
export const AdminOnly = ({ children, fallback = null }) => {
  return <RoleBasedContent roles={['admin']} fallback={fallback}>{children}</RoleBasedContent>;
};

// Component to render content only for partners
export const PartnerOnly = ({ children, fallback = null }) => {
  return <RoleBasedContent roles={['partner']} fallback={fallback}>{children}</RoleBasedContent>;
};

// Hook to check if user has specific role
export const useHasRole = (role) => {
  const { currentUser } = useAuth();
  return !!currentUser && currentUser.role === role;
};

// Hook to check if user has one of the specified roles
export const useHasAnyRole = (roles = []) => {
  const { currentUser } = useAuth();
  return !!currentUser && roles.includes(currentUser.role);
};
