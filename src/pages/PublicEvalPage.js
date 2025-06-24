import React, { useEffect, useState } from 'react';
import { GcdsContainer, GcdsText, GcdsLink } from '@cdssnc/gcds-components-react';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import { useTranslations } from '../hooks/useTranslations.js';
import { usePageContext } from '../hooks/usePageParam.js';
import DataStoreService from '../services/DataStoreService.js';

DataTable.use(DT);

const PublicEvalPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const { language } = usePageContext();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    DataStoreService.getPublicEvalList()
      .then(data => setRows(data.chats || []))
      .catch(err => console.error('Failed to load list', err));
  }, []);

  return (
    <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
      <h1 className="mb-400">{t('admin.publicEval.title', 'Public Evaluation')}</h1>
      <nav className="mb-400" aria-label={t('admin.navigation.ariaLabel', 'Admin Navigation')}>
        <GcdsText>
          <GcdsLink href={`/${language}/admin`}>{t('common.backToAdmin', 'Back to Admin')}</GcdsLink>
        </GcdsText>
      </nav>
      <DataTable
        data={rows}
        columns={[
          {
            title: t('admin.publicEval.chatId', 'Chat ID'),
            data: 'chatId',
            render: (data) => `<a href="/${language}?chat=${data}&review=1">${data}</a>`
          },
          { title: t('admin.publicEval.department', 'Department'), data: 'department' }
        ]}
        options={{ paging: true, searching: true, ordering: true }}
      />
    </GcdsContainer>
  );
};

export default PublicEvalPage;
