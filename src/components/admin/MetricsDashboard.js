import React, { useState } from 'react';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import DataStoreService from '../../services/DataStoreService.js';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import ExportService from '../../services/ExportService.js';
import { useTranslations } from '../../hooks/useTranslations.js';

DataTable.use(DT);

const MetricsDashboard = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const [timeRange, setTimeRange] = useState('7');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await DataStoreService.getChatLogs({ days: timeRange });
      if (data.success) {
        // Process the logs to calculate metrics
        const processedMetrics = processMetrics(data.logs || []);
        setMetrics(processedMetrics);
      } else {
        console.error('API returned error:', data.error);
        alert(data.error || 'Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      alert(`Failed to fetch metrics: ${error.message}`);
    }
    setLoading(false);
  };

  const processMetrics = (logs) => {
    // Use a local Set to track unique chatIds
    const uniqueChatIds = new Set();
    // Initialize metrics object
    const metrics = {
      totalSessions: logs.length,
      totalQuestions: 0,
      totalConversations: 0, // Will set this at the end
      humanScored: {
        total: 0,
        correct: 0,
        needsImprovement: 0,
        hasError: 0
      },
      aiScored: {
        total: 0,
        correct: 0,
        needsImprovement: 0,
        hasError: 0
      },
      byDepartment: {}
    };

    // Process each chat document
    logs.forEach(chat => {
      // Track unique chatIds from the chat document
      if (chat.chatId) {
        uniqueChatIds.add(chat.chatId);
      }

      // Process each interaction in the chat
      chat.interactions?.forEach(interaction => {
        // Count total questions
        metrics.totalQuestions++;
        
        // Get department
        const department = interaction.context?.department || 'Unknown';
        
        // Initialize department metrics if not exists
        if (!metrics.byDepartment[department]) {
          metrics.byDepartment[department] = {
            total: 0,
            humanScored: {
              total: 0,
              correct: 0,
              needsImprovement: 0,
              hasError: 0
            }
          };
        }

        // Increment department total
        metrics.byDepartment[department].total++;

        // Process human-scored metrics
        if (interaction.expertFeedback?.totalScore !== undefined) {
          metrics.humanScored.total++;
          metrics.byDepartment[department].humanScored.total++;
          
          const score = interaction.expertFeedback.totalScore;
          if (score === 100) {
            metrics.humanScored.correct++;
            metrics.byDepartment[department].humanScored.correct++;
          } else if (score >= 82 && score <= 99) {
            metrics.humanScored.needsImprovement++;
            metrics.byDepartment[department].humanScored.needsImprovement++;
          } else {
            metrics.humanScored.hasError++;
            metrics.byDepartment[department].humanScored.hasError++;
          }
        }

        // Process AI-scored metrics
        if (interaction.autoEval?.expertFeedback?.totalScore !== undefined) {
          metrics.aiScored.total++;
          const score = interaction.autoEval.expertFeedback.totalScore;
          if (score === 100) {
            metrics.aiScored.correct++;
          } else if (score >= 82 && score <= 99) {
            metrics.aiScored.needsImprovement++;
          } else {
            metrics.aiScored.hasError++;
          }
        }
      });
    });

    // Set the totalConversations as the number of unique chatIds
    metrics.totalConversations = uniqueChatIds.size;

    return metrics;
  };

  // Commenting out export functions for now
  /*
  const filename = (ext) => {
    let name = 'metrics-' + timeRange + '-' + new Date().toISOString();
    return name + '.' + ext;
  };

  const downloadJSON = () => {
    const json = JSON.stringify(metrics, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename('json');
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    ExportService.export(metrics, filename('csv'));
  };

  const downloadExcel = () => {
    ExportService.export(metrics, filename('xlsx'));
  };
  */

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <label htmlFor="timeRange" className="block text-sm font-medium text-gray-700 mb-1">
            Time range
          </label>
          <select
            id="timeRange"
            name="timeRange"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="1">Last 1 day</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        <GcdsButton
          onClick={fetchMetrics}
          disabled={loading}
          className="me-400 hydrated mrgn-tp-1r"
        >
          {loading ? 'Loading...' : 'Get metrics'}
        </GcdsButton>

        {/* Commenting out export buttons for now
        {metrics.totalSessions > 0 && (
          <>
            <GcdsButton
              onClick={downloadJSON}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              Download JSON
            </GcdsButton>

            <GcdsButton
              onClick={downloadCSV}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              Download CSV
            </GcdsButton>
            <GcdsButton
              onClick={downloadExcel}
              disabled={loading}
              className="me-400 hydrated mrgn-tp-1r"
            >
              Download Excel
            </GcdsButton>
          </>
        )}
        */}
      </div>

      <div className="bg-white shadow rounded-lg mb-600">
        {loading ? (
          <div className="p-4">
            <p className="text-gray-500">Loading metrics...</p>
          </div>
        ) : metrics.totalSessions > 0 ? (
          <div className="p-4">
            <h2 className="mt-400 mb-400">{t('metrics.dashboard.title')}</h2>
            <div className="bg-gray-50 p-4 rounded-lg mb-600">
              <h3 className="mb-300">{t('metrics.dashboard.totalQuestions')}</h3>
              <p className="text-xl">{metrics.totalQuestions}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-600">
              <h3 className="mb-300">{t('metrics.dashboard.totalSessions')}</h3>
              <p className="text-xl">{metrics.totalConversations}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-600">
              <div className="bg-gray-50 p-4 rounded-lg mb-600 md:mb-0">
                <h3 className="mb-300">{t('metrics.dashboard.humanScored.title')}</h3>
                <div className="space-y-2">
                  <p>{t('metrics.dashboard.humanScored.total')}: {metrics.humanScored.total}</p>
                  <p>{t('metrics.dashboard.humanScored.correct')}: {metrics.humanScored.correct} ({metrics.humanScored.total ? Math.round((metrics.humanScored.correct / metrics.humanScored.total) * 100) : 0}%)</p>
                  <p>{t('metrics.dashboard.humanScored.needsImprovement')}: {metrics.humanScored.needsImprovement} ({metrics.humanScored.total ? Math.round((metrics.humanScored.needsImprovement / metrics.humanScored.total) * 100) : 0}%)</p>
                  <p>{t('metrics.dashboard.humanScored.hasError')}: {metrics.humanScored.hasError} ({metrics.humanScored.total ? Math.round((metrics.humanScored.hasError / metrics.humanScored.total) * 100) : 0}%)</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="mb-300">{t('metrics.dashboard.aiScored.title')}</h3>
                <div className="space-y-2">
                  <p>{t('metrics.dashboard.aiScored.total')}: {metrics.aiScored.total}</p>
                  <p>{t('metrics.dashboard.aiScored.correct')}: {metrics.aiScored.correct} ({metrics.aiScored.total ? Math.round((metrics.aiScored.correct / metrics.aiScored.total) * 100) : 0}%)</p>
                  <p>{t('metrics.dashboard.aiScored.needsImprovement')}: {metrics.aiScored.needsImprovement} ({metrics.aiScored.total ? Math.round((metrics.aiScored.needsImprovement / metrics.aiScored.total) * 100) : 0}%)</p>
                  <p>{t('metrics.dashboard.aiScored.hasError')}: {metrics.aiScored.hasError} ({metrics.aiScored.total ? Math.round((metrics.aiScored.hasError / metrics.aiScored.total) * 100) : 0}%)</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-600">
              <h3 className="mb-300">{t('metrics.dashboard.byDepartment.title')}</h3>
              <DataTable
                data={Object.entries(metrics.byDepartment).map(([department, data]) => ({
                  department,
                  totalQuestions: data.total,
                  humanScoredTotal: data.humanScored.total,
                  humanScoredCorrect: data.humanScored.correct,
                  humanScoredNeedsImprovement: data.humanScored.needsImprovement,
                  humanScoredHasError: data.humanScored.hasError,
                  humanScoredHasErrorPercent: data.humanScored.total ? Math.round((data.humanScored.hasError / data.humanScored.total) * 100) : 0
                }))}
                columns={[
                  { title: t('metrics.dashboard.byDepartment.title'), data: 'department' },
                  { title: t('metrics.dashboard.byDepartment.totalQuestions'), data: 'totalQuestions' },
                  { title: t('metrics.dashboard.humanScored.total'), data: 'humanScoredTotal' },
                  { title: t('metrics.dashboard.humanScored.correct'), data: 'humanScoredCorrect' },
                  { title: t('metrics.dashboard.humanScored.needsImprovement'), data: 'humanScoredNeedsImprovement' },
                  { 
                    title: t('metrics.dashboard.humanScored.hasError'), 
                    data: 'humanScoredHasError',
                    render: (data, type, row) => {
                      if (type === 'display') {
                        return `${data} (${row.humanScoredHasErrorPercent}%)`;
                      }
                      return data;
                    }
                  }
                ]}
                options={{
                  paging: true,
                  pageLength: 25,
                  searching: true,
                  ordering: true,
                  order: [[1, 'desc']]
                }}
              />
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-gray-500">
              Select a time range and click 'Get metrics' to view performance metrics
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsDashboard; 