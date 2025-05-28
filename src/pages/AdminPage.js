import React from 'react';
import { useTranslations } from '../hooks/useTranslations.js';
import { GcdsContainer, GcdsLink } from '@cdssnc/gcds-components-react';
import { usePageContext } from '../hooks/usePageParam.js';
import { useAuth } from '../contexts/AuthContext.js';
import ChatLogsDashboard from '../components/admin/ChatLogsDashboard.js';
import DeleteChatSection from '../components/admin/DeleteChatSection.js';

const AdminPage = () => {
  const { t } = useTranslations();
  const { language } = usePageContext();
  const { logout } = useAuth();

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
  };

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('admin.title', 'Admin Dashboard')}</h1>
      
      <nav className="mb-400" aria-label={t('admin.navigation.ariaLabel', 'Admin Navigation')}>
        <h2 className="mt-400 mb-400">{t('admin.navigation.title', 'Admin Menu')}</h2>
        <ul className="list-none p-0">
          <li className="">
            <GcdsLink href={`/${language}`}>
              {t('admin.navigation.aiAnswers', 'AI Answers')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href={`/${language}/batch`}>
              {t('admin.navigation.batches', 'Batches')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href={`/${language}/users`}>
              {t('admin.navigation.users', 'User Management')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href={`/${language}/chat-viewer`}>
              {t('admin.navigation.chatViewer')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href={`/${language}/database`}>
              {t('admin.navigation.database', 'Database Management')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href={`/${language}/eval`}>
              {t('admin.navigation.eval', 'Evaluation Tools')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href={`/${language}/metrics`}>
              {t('admin.navigation.metrics', 'View performance metrics')}
            </GcdsLink>
          </li>
          <li className="">
            <GcdsLink href="#" onClick={handleLogout}>
              {t('admin.navigation.logout', 'Logout')}
            </GcdsLink>
          </li>
        </ul>
      </nav>

      <DeleteChatSection />

      <section id="chat-logs" className="mb-600">
        <h2 className="mt-400 mb-400">{t('admin.chatLogs.title', 'Recent Chat Interactions')}</h2>
        <ChatLogsDashboard />
      </section>
    </GcdsContainer>
  );
};

export default AdminPage;
