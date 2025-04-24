import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import DataTable from 'datatables.net-react';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import DT from 'datatables.net-dt';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../../hooks/useTranslations.js';

DataTable.use(DT);

const BatchList = ({ buttonAction, batchStatus, lang, batches }) => {
  const [searchText] = React.useState('');
  const { t } = useTranslations(lang);

  // Memoize the columns configuration to prevent unnecessary re-renders
  const columns = useMemo(
    () => [
      { title: t('batch.list.columns.batchName'), data: 'name' },
      { title: t('batch.list.columns.batchId'), data: '_id' },
      { title: t('batch.list.columns.createdDate'), data: 'createdAt' },
      { title: t('batch.list.columns.provider'), data: 'aiProvider' },
      // Add Progress column
      {
        title: t('batch.list.columns.progress') || 'Progress',
        data: null,
        render: (data, type, row) => `${row.processedItems ?? 0} / ${row.totalItems ?? 0}`,
      },
      // Add new column for overrides
      {
        title: t('batch.list.columns.overrides'),
        data: 'applyOverrides',
        render: (data, type, row) =>
          row.applyOverrides ? t('batch.list.overrides.enabled') : t('batch.list.overrides.disabled'),
      },
      { title: t('batch.list.columns.status'), data: 'status' },
      {
        title: t('batch.list.columns.action'),
        data: null,
        defaultContent: '',
      },
    ],
    [t]
  );

  // Filter batches based on batchStatus and search text
  // Treat 'completed' as a final/processed state for UI purposes
  const filteredBatches = (batches || []).filter(
    (batch) => {
      // If the UI is asking for 'processed', include 'completed' as well
      const statusList = batchStatus.split(',');
      const batchStatusForFilter = statusList.includes('processed')
        ? [...statusList, 'completed']
        : statusList;
      return (
        batchStatusForFilter.includes(batch.status) &&
        Object.values(batch).some((value) =>
          value?.toString().toLowerCase().includes(searchText.toLowerCase())
        )
      );
    }
  );

  return (
    <div>
      <DataTable
        data={filteredBatches}
        columns={columns}
        options={{
          paging: true,
          searching: true,
          ordering: true,
          order: [[2, 'desc']],
          createdRow: (row, data) => {
            const { _id, status, aiProvider } = data; // Use _id
            const actionsCell = row.querySelector('td:last-child');
            actionsCell.innerHTML = '';
            const root = createRoot(actionsCell);

            if (status === 'processed' || status === 'completed') {
              const ActionButtons = () => {
                const [clicked, setClicked] = React.useState(false);
                if (clicked) return null;
                return (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <GcdsButton
                      size="small"
                      onClick={() => {
                        buttonAction(_id, 'csv', aiProvider);
                        setClicked(true);
                      }}
                    >
                      {t('batch.list.actions.csv')}
                    </GcdsButton>
                    <GcdsButton
                      size="small"
                      onClick={() => {
                        buttonAction(_id, 'excel', aiProvider);
                        setClicked(true);
                      }}
                    >
                      {t('batch.list.actions.excel')}
                    </GcdsButton>
                  </div>
                );
              };
              root.render(<ActionButtons />);
            } else {
              const ActionButtonCancel = () => {
                const [clicked, setClicked] = React.useState(false);
                if (clicked) return null;
                return (
                  <GcdsButton
                    size="small"
                    onClick={() => {
                      buttonAction(_id, 'cancel', aiProvider);
                      setClicked(true);
                    }}
                  >
                    {t('batch.list.actions.cancel')}
                  </GcdsButton>
                );
              };
              root.render(<ActionButtonCancel />);
            }
          },
        }}
        key={lang}
      />
    </div>
  );
};

export default BatchList;
