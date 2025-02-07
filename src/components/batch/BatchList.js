import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot
import DataTable from 'datatables.net-react';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import DT from 'datatables.net-dt';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import { getApiUrl, getProviderApiUrl } from '../../utils/apiToUrl.js';
import { useTranslations } from '../../hooks/useTranslations.js';

DataTable.use(DT);

const BatchList = ({ buttonAction, batchStatus, lang }) => {
    const [batches, setBatches] = useState([]);
    const [searchText] = useState('');
    const { t } = useTranslations(lang); // TODO: Pass actual language from props/context

    // Fetch batch status
    const fetchStatus = async (batchId, aiProvider) => {
        try {
            const response = await fetch(getProviderApiUrl(aiProvider, `batch-status?batchId=${batchId}`));
            const data = await response.json();
            return { batchId, status: data.status };
        } catch (error) {
            console.error(`Error fetching status for batch ${batchId}:`, error);
            return { batchId, status: 'Error' };
        }
    };

    // Fetch all statuses
    const fetchStatuses = useCallback(async (batches) => {
        try {
            const statusPromises = batches.map(batch => {
                if (!batch.status) {
                    return fetchStatus(batch.batchId, batch.aiProvider);
                } else {
                    return Promise.resolve({ batchId: batch.batchId, status: batch.status });
                }
            });
            const statusResults = await Promise.all(statusPromises);
            return batches.map(batch => {
                const statusResult = statusResults.find(status => status.batchId === batch.batchId);
                return { ...batch, status: statusResult ? statusResult.status : 'Unknown' };
            });
        } catch (error) {
            console.error('Error fetching statuses:', error);
        }
    }, []); // No dependencies needed as it doesn't use any external values

    // Memoize the columns configuration to prevent unnecessary re-renders
    const columns = useMemo(() => [
        { title: t('batch.list.columns.batchName'), data: 'name' },
        { title: t('batch.list.columns.batchId'), data: 'batchId' },
        { title: t('batch.list.columns.createdDate'), data: 'createdAt' },
        { title: t('batch.list.columns.provider'), data: 'aiProvider' },
        { title: t('batch.list.columns.type'), data: 'type' },
        { title: t('batch.list.columns.status'), data: 'status' },
        {
            title: t('batch.list.columns.action'),
            data: null,
            defaultContent: '',
        },
    ], [t]);

    // Fetch batches
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const response = await fetch(getApiUrl('db-batch-list'));
                let batches = await response.json();
                batches = await fetchStatuses(batches);
                setBatches(batches);
            } catch (error) {
                console.error('Error fetching batches:', error);
            }
        };

        fetchBatches();

        const intervalId = setInterval(fetchBatches, 5000); // Poll every 5 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [lang,fetchStatuses]); // Add lang as a dependency

    // Handle button click
    const handleButtonClick = (batchId, action, provider) => {
        buttonAction(batchId, action, provider);
    };

    // Filter batches based on batchStatus and search text
    const filteredBatches = batches.filter(batch =>
        batchStatus.split(',').includes(batch.status) &&
        Object.values(batch).some(value =>
            value?.toString().toLowerCase().includes(searchText.toLowerCase())
        )
    );

    return (
        <div>
            <DataTable
                data={filteredBatches}
                columns={columns} // Use memoized columns
                options={{
                    paging: true,
                    searching: true,
                    ordering: true,
                    order: [[1, 'desc']], // Order by Created Date (column index 1) descending
                    createdRow: (row, data) => {
                        const { batchId, status, aiProvider } = data;

                        // Clear and append custom buttons dynamically
                        const actionsCell = row.querySelector('td:last-child');
                        if (status === 'processed') {
                            actionsCell.innerHTML = '';
                            const root = createRoot(actionsCell);
                            root.render(
                                <>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <GcdsButton size="small" onClick={() => handleButtonClick(batchId, 'csv')}>{t('batch.list.actions.csv')}</GcdsButton>
                                        <GcdsButton size="small" onClick={() => handleButtonClick(batchId, 'excel')}>{t('batch.list.actions.excel')}</GcdsButton>
                                    </div>
                                </>
                            );
                        } else if (status === 'completed') {
                            actionsCell.innerHTML = '';
                            const root = createRoot(actionsCell);
                            root.render(
                                <GcdsButton size="small" onClick={() => handleButtonClick(batchId, 'complete', aiProvider)}>{t('batch.list.actions.process')}</GcdsButton>
                            );
                        } else if (status === 'processing') {
                            actionsCell.innerHTML = '';
                            const root = createRoot(actionsCell);
                            root.render(
                                <GcdsButton size="small" onClick={() => handleButtonClick(batchId, 'cancel', aiProvider)}>{t('batch.list.actions.cancel')}</GcdsButton>
                            );
                        }
                    },
                }}
                key={lang} // Add key prop to force re-render when language changes
            />
        </div>
    );
};

export default BatchList;
