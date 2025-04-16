import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import DataTable from 'datatables.net-react';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import DT from 'datatables.net-dt';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import { getApiUrl } from '../utils/apiToUrl.js';
import { useTranslations } from '../hooks/useTranslations.js';
import AuthService from '../services/AuthService.js';

DataTable.use(DT);

const UsersPage = ({ lang }) => {
  const [users, setUsers] = useState([]);
  const { t } = useTranslations(lang);

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(getApiUrl('db-users'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        body: JSON.stringify({
          userId,
          active: !currentStatus
        })
      });

      if (response.ok) {
        // Update state which will trigger a re-render of DataTable
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user._id === userId ? { ...user, active: !currentStatus } : user
          )
        );
      } else {
        console.error('Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  // Memoize the columns configuration
  const columns = useMemo(
    () => [
      { title: t('users.columns.email'), data: 'email' },
      { title: t('users.columns.role'), data: 'role' },
      { 
        title: t('users.columns.status'), 
        data: 'active',
        render: (data) => data ? t('users.status.active') : t('users.status.inactive')
      },
      { 
        title: t('users.columns.createdAt'), 
        data: 'createdAt',
        render: (data) => new Date(data).toLocaleDateString()
      },
      {
        title: t('users.columns.action'),
        data: null,
        defaultContent: '',
      },
    ],
    [t]
  );

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(getApiUrl('db-users'), {
          headers: AuthService.getAuthHeader()
        });
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="container mt-4">
      <h1>{t('users.title')}</h1>
      <DataTable
        data={users}
        columns={columns}
        options={{
          paging: true,
          searching: true,
          ordering: true,
          order: [[3, 'desc']], // Order by createdAt column descending
          createdRow: (row, data) => {
            const actionsCell = row.querySelector('td:last-child');
            actionsCell.innerHTML = '';
            const root = createRoot(actionsCell);
            
            root.render(
              <GcdsButton
                size="small"
                variant={data.active ? "danger" : "success"}
                onClick={() => toggleUserStatus(data._id, data.active)}
              >
                {data.active ? t('users.actions.deactivate') : t('users.actions.activate')}
              </GcdsButton>
            );
          },
        }}
      />
    </div>
  );
};

export default UsersPage;