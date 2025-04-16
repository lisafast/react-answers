/* eslint-disable no-unused-vars */
/* eslint-disable import/no-unused-modules */
import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.js';
import AdminPage from './pages/AdminPage.js';
import BatchPage from './pages/BatchPage.js';
import ChatViewer from './pages/ChatViewer.js';
import SignupPage from './pages/SignupPage.js';
import LoginPage from './pages/LoginPage.js';
import { GcdsHeader, GcdsBreadcrumbs, GcdsFooter } from '@cdssnc/gcds-components-react';
import AuthService from './services/AuthService.js';
import './styles/App.css';
import UsersPage from './pages/UsersPage.js';
import EvalPage from './pages/EvalPage.js';
import DatabasePage from './pages/DatabasePage.js';
import PromptsPage from './pages/PromptsPage.js'; // Added for prompts management
import SettingsPage from './pages/SettingsPage.js';

// Helper function to get alternate language path
const getAlternatePath = (currentPath, currentLang) => {
  const newLang = currentLang === 'en' ? 'fr' : 'en';
  if (currentPath === '/' || currentPath === '/fr') {
    return `/${newLang}`;
  }
  // Remove leading language identifier if it exists and add new one
  const pathWithoutLang = currentPath.replace(/^\/(en|fr)/, '');
  return `/${newLang}${pathWithoutLang}`;
};

// Protected Route component to handle authentication
const ProtectedRoute = ({ element }) => {
  const location = useLocation();
  const currentLang = location.pathname.startsWith('/fr') ? 'fr' : 'en';

  // Simple check for authentication status
  if (!AuthService.isAuthenticated()) {
    // At this point, if the token was expired, isAuthenticated() has already
    // called logout() which will handle the redirect on its own
    
    // For all other authentication failures, redirect to login
    return <Navigate to={`/${currentLang}/login`} state={{ from: location }} replace />;
  }
  
  return element;
};

const AppLayout = () => {
  const location = useLocation();
  const currentLang = location.pathname.startsWith('/fr') ? 'fr' : 'en';
  const alternateLangHref = getAlternatePath(location.pathname, currentLang);

  // Set up token expiration checker when the app layout mounts
  useEffect(() => {
    // Removed the auth expiration checker setup
  }, []);

  return (
    <>
      <section className="alpha-top">
        <div className="container">
          <small>
            <span className="alpha-label">Alpha</span>&nbsp;&nbsp;
            {currentLang === 'en'
              ? 'Experimental page - not public.'
              : 'Page expérimentale - non publique.'}
          </small>
        </div>
      </section>
      <GcdsHeader 
        lang={currentLang} 
        langHref={alternateLangHref} 
        skipToHref="#main-content"
      >
        <GcdsBreadcrumbs slot="breadcrumb">
          {/* Add breadcrumb items as needed */}
        </GcdsBreadcrumbs>
      </GcdsHeader>
      <main id="main-content">
        {/* Outlet will be replaced by the matching route's element */}
        <Outlet />
      </main>
      <GcdsFooter display="compact" lang={currentLang} />
    </>
  );
};

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <HomePage lang="en" />,
      },
      {
        path: "/en",
        element: <HomePage lang="en" />,
      },
      {
        path: "/fr",
        element: <HomePage lang="fr" />,
      },
      {
        path: "/en/signup",
        element: <SignupPage lang="en" />,
      },
      {
        path: "/fr/signup",
        element: <SignupPage lang="fr" />,
      },
      {
        path: "/en/login",
        element: <LoginPage lang="en" />,
      },
      {
        path: "/fr/login",
        element: <LoginPage lang="fr" />,
      },
      // Protected routes
      {
        path: "/en/admin",
        element: <ProtectedRoute element={<AdminPage lang="en" />} />,
      },
      {
        path: "/fr/admin",
        element: <ProtectedRoute element={<AdminPage lang="fr" />} />,
      },
      {
        path: "/en/batch",
        element: <ProtectedRoute element={<BatchPage lang="en" />} />,
      },
      {
        path: "/fr/batch",
        element: <ProtectedRoute element={<BatchPage lang="fr" />} />,
      },
      {
        path: "/:language/chat-viewer",
        element: <ProtectedRoute element={<ChatViewer lang="en" />} />,
      },
      {
        path: "/:language/chat-viewer",
        element: <ProtectedRoute element={<ChatViewer lang="fr" />} />,
      },
      {
        path: "/en/users",
        element: <ProtectedRoute element={<UsersPage lang="en" />} />,
      },
      {
        path: "/fr/users",
        element: <ProtectedRoute element={<UsersPage lang="fr" />} />,
      },
      {
        path: "/en/eval",
        element: <ProtectedRoute element={<EvalPage lang="en" />} />,
      },
      {
        path: "/fr/eval",
        element: <ProtectedRoute element={<EvalPage lang="fr" />} />,
      },
      {
        path: "/en/database",
        element: <ProtectedRoute element={<DatabasePage lang="en" />} />,
      },
      {
        path: "/fr/database",
        element: <ProtectedRoute element={<DatabasePage lang="fr" />} />,
      },
      // Added Prompts routes
      {
        path: "/en/prompts",
        element: <ProtectedRoute element={<PromptsPage lang="en" />} />,
      },
      {
        path: "/fr/prompts",
        element: <ProtectedRoute element={<PromptsPage lang="fr" />} />,
      },
      {
        path: "/en/settings",
        element: <ProtectedRoute element={<SettingsPage />} />,
      },
      {
        path: "/fr/settings",
        element: <ProtectedRoute element={<SettingsPage />} />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
