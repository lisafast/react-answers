import React, { useState } from 'react';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import DataStoreService from '../../services/DataStoreService.js';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import ExportService from '../../services/ExportService.js';
import { useTranslations } from '../../hooks/useTranslations.js';
DataTable.use(DT);

const ChatLogsDashboard = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [timeRange, setTimeRange] = useState('1');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await DataStoreService.getChatLogs({ days: timeRange });
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        console.error('API returned error:', data.error);
        alert(data.error || 'Failed to fetch logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      alert(`Failed to fetch logs: ${error.message}`);
    }
    setLoading(false);
  };

  const filename = (ext) => {
    let name = 'chat-logs-' + timeRange + '-' + new Date().toISOString();
    return name + '.' + ext;
  };

  const downloadJSON = () => {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename('json');
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    ExportService.export(logs, filename('csv'));
  };

  const downloadExcel = () => {
    ExportService.export(logs, filename('xlsx'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <label htmlFor="timeRange" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.chatLogs.timeRange')}
          </label>
          <select
            id="timeRange"
            name="timeRange"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="1">{t('admin.chatLogs.last1Day')}</option>
            <option value="7">{t('admin.chatLogs.last7Days')}</option>
            <option value="30">{t('admin.chatLogs.last30Days')}</option>
            <option value="60">{t('admin.chatLogs.last60Days')}</option>
            <option value="90">{t('admin.chatLogs.last90Days')}</option>
            <option value="all">{t('admin.chatLogs.allLogs')}</option>
          </select>
        </div>

        <GcdsButton
          onClick={fetchLogs}
          disabled={loading}
          className="me-400 hydrated mrgn-tp-1r"
        >
          {loading ? t('admin.chatLogs.loading') : t('admin.chatLogs.getLogs')}
        </GcdsButton>

        {logs.length > 0 && (
          <>
            <GcdsButton
              onClick={downloadJSON}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              {t('admin.chatLogs.downloadJson')}
            </GcdsButton>

            <GcdsButton
              onClick={downloadCSV}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              {t('admin.chatLogs.downloadCsv')}
            </GcdsButton>
            <GcdsButton
              onClick={downloadExcel}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              {t('admin.chatLogs.downloadExcel')}
            </GcdsButton>
          </>
        )}
      </div>

      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-4">
            <p className="text-gray-500">{t('admin.chatLogs.loadingLogs')}</p>
          </div>
        ) : logs.length > 0 ? (
          <div className="p-4">
            <p className="mb-4 text-gray-600">
              {t('admin.chatLogs.found')} {logs.length} {t('admin.chatLogs.interactionsFound')}
            </p>
            <DataTable
              data={logs}
              columns={[
                { title: t('admin.chatLogs.date'), data: 'createdAt', render: (data) => (data ? data : '') },
                { title: t('admin.chatLogs.chatId'), data: 'chatId', render: (data) => (data ? data : '') },
                {
                  title: t('admin.chatLogs.interactions'),
                  data: 'interactions',
                  render: (data) => (data ? data.length : 0),
                },
              ]}
              options={{
                paging: true,
                searching: true,
                ordering: true,
                order: [[0, 'desc']],
              }}
            />
          </div>
        ) : (
          <div className="p-4">
            <p className="text-gray-500">
              {t('admin.chatLogs.selectRange')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatLogsDashboard;
