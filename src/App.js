import  { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.js';
import AdminPage from './pages/AdminPage.js';
import BatchPage from './pages/BatchPage.js';
import ChatViewer from './pages/ChatViewer.js';
import SignupPage from './pages/SignupPage.js';
import LoginPage from './pages/LoginPage.js';
import LogoutPage from './pages/LogoutPage.js';
import { GcdsHeader, GcdsBreadcrumbs, GcdsFooter } from '@cdssnc/gcds-components-react';
import './styles/App.css';
import UsersPage from './pages/UsersPage.js';
import EvalPage from './pages/EvalPage.js';
import DatabasePage from './pages/DatabasePage.js';
import PromptsPage from './pages/PromptsPage.js'; // Added for prompts management
import SettingsPage from './pages/SettingsPage.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { AdminRoute, RoleProtectedRoute } from './components/RoleProtectedRoute.js';

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

// We're now using the ProtectedRoute component from components/ProtectedRoute.js

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

const routes = {
  public: [
    { path: "/", element: <HomePage lang="en" /> },
    { path: "/en", element: <HomePage lang="en" /> },
    { path: "/fr", element: <HomePage lang="fr" /> },
    { path: "/en/login", element: <LoginPage lang="en" /> },
    { path: "/fr/login", element: <LoginPage lang="fr" /> },
    { path: "/en/signup", element: <SignupPage lang="en" /> },
    { path: "/fr/signup", element: <SignupPage lang="fr" /> },
    { path: "/en/logout", element: <LogoutPage lang="en" /> },
    { path: "/fr/logout", element: <LogoutPage lang="fr" /> }
  ],
  protected: [
    {
      path: "/en/admin",
      element: <AdminPage lang="en" />,
      roles: ['admin']
    },
    {
      path: "/fr/admin",
      element: <AdminPage lang="fr" />,
      roles: ['admin']
    },
    {
      path: "/en/batch",
      element: <AdminRoute lang="en"><BatchPage lang="en" /></AdminRoute>,
    },
    {
      path: "/fr/batch",
      element: <AdminRoute lang="fr"><BatchPage lang="fr" /></AdminRoute>,
    },
    {
      path: "/en/chat-viewer",
      element: <AdminRoute lang="en"><ChatViewer lang="en" /></AdminRoute>,
    },
    {
      path: "/fr/chat-viewer",
      element: <AdminRoute lang="fr"><ChatViewer lang="fr" /></AdminRoute>,
    },
    {
      path: "/en/users",
      element: <AdminRoute lang="en"><UsersPage lang="en" /></AdminRoute>,
    },
    {
      path: "/fr/users",
      element: <AdminRoute lang="fr"><UsersPage lang="fr" /></AdminRoute>,
    },
    {
      path: "/en/eval",
      element: <AdminRoute lang="en"><EvalPage lang="en" /></AdminRoute>,
    },
    {
      path: "/fr/eval",
      element: <AdminRoute lang="fr"><EvalPage lang="fr" /></AdminRoute>,
    },
    {
      path: "/en/database",
      element: <AdminRoute lang="en"><DatabasePage lang="en" /></AdminRoute>,
    },
    {
      path: "/fr/database",
      element: <AdminRoute lang="fr"><DatabasePage lang="fr" /></AdminRoute>,
    },
  ]
};

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      
      ...routes.public,
            ...routes.protected.map(route => ({
        path: route.path,
        element: (
          <RoleProtectedRoute roles={route.roles} lang={route.path.includes('/fr/') ? 'fr' : 'en'}>
            {route.element}
          </RoleProtectedRoute>
        )
      }))
    ]
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
