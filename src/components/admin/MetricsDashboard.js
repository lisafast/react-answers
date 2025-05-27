import React, { useState } from 'react';
import { GcdsButton, GcdsContainer, GcdsText } from '@cdssnc/gcds-components-react';
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
      expertScored: {
        total: 0,
        correct: 0,
        needsImprovement: 0,
        hasError: 0
      },
      userScored: {
        total: 0,
        helpful: 0,
        unhelpful: 0
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
            expertScored: {
              total: 0,
              correct: 0,
              needsImprovement: 0,
              hasError: 0
            },
            userScored: {
              total: 0,
              helpful: 0,
              unhelpful: 0
            }
          };
        }

        // Increment department total
        metrics.byDepartment[department].total++;

        // Process human- and user-scored metrics
        if (interaction.expertFeedback?.totalScore !== undefined && interaction.expertFeedback?.type) {
          const type = interaction.expertFeedback.type;
          const score = interaction.expertFeedback.totalScore;
          if (type === 'expert') {
            metrics.expertScored.total++;
            metrics.byDepartment[department].expertScored.total++;
            if (score === 100) {
              metrics.expertScored.correct++;
              metrics.byDepartment[department].expertScored.correct++;
            } else if (score >= 82 && score <= 99) {
              metrics.expertScored.needsImprovement++;
              metrics.byDepartment[department].expertScored.needsImprovement++;
            } else {
              metrics.expertScored.hasError++;
              metrics.byDepartment[department].expertScored.hasError++;
            }
          } else if (type === 'public') {
            metrics.userScored.total++;
            metrics.byDepartment[department].userScored.total++;
            if (score >= 90) {
              metrics.userScored.helpful++;
              metrics.byDepartment[department].userScored.helpful++;
            } else {
              metrics.userScored.unhelpful++;
              metrics.byDepartment[department].userScored.unhelpful++;
            }
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
    <GcdsContainer size="xl" className="space-y-6">
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

      <GcdsContainer size="xl" className="bg-white shadow rounded-lg mb-600">
        {loading ? (
          <div className="p-4">
            <GcdsText>Loading metrics...</GcdsText>
          </div>
        ) : metrics.totalSessions > 0 ? (
          <div className="p-4">
            <h2 className="mt-400 mb-400">{t('metrics.dashboard.title')}</h2>
            <div>
              <h3 className="mb-300">{t('metrics.dashboard.usageMetrics')}</h3>
              <div>
                <GcdsText>{t('metrics.dashboard.totalSessions')}: {metrics.totalConversations}</GcdsText>
                <GcdsText>{t('metrics.dashboard.totalQuestions')}: {metrics.totalQuestions}</GcdsText>
              </div>
            </div>
            <div>
              <div>
                <h3>{t('metrics.dashboard.expertScored.title')}</h3>
                <GcdsText className="mb-300">{t('metrics.dashboard.expertScored.description')}</GcdsText>
                <div>
                  <GcdsText>{t('metrics.dashboard.expertScored.total')}: {metrics.expertScored.total}</GcdsText>
                  <GcdsText>{t('metrics.dashboard.expertScored.correct')}: {metrics.expertScored.correct} ({metrics.expertScored.total ? Math.round((metrics.expertScored.correct / metrics.expertScored.total) * 100) : 0}%)</GcdsText>
                  <GcdsText>{t('metrics.dashboard.expertScored.needsImprovement')}: {metrics.expertScored.needsImprovement} ({metrics.expertScored.total ? Math.round((metrics.expertScored.needsImprovement / metrics.expertScored.total) * 100) : 0}%)</GcdsText>
                  <GcdsText>{t('metrics.dashboard.expertScored.hasError')}: {metrics.expertScored.hasError} ({metrics.expertScored.total ? Math.round((metrics.expertScored.hasError / metrics.expertScored.total) * 100) : 0}%)</GcdsText>
                </div>
              </div>
              <div>
                <h3>{t('metrics.dashboard.aiScored.title')}</h3>
                <GcdsText className="mb-300">{t('metrics.dashboard.aiScored.description')}</GcdsText>
                <div>
                  <GcdsText>{t('metrics.dashboard.aiScored.total')}: {metrics.aiScored.total}</GcdsText>
                  <GcdsText>{t('metrics.dashboard.aiScored.correct')}: {metrics.aiScored.correct} ({metrics.aiScored.total ? Math.round((metrics.aiScored.correct / metrics.aiScored.total) * 100) : 0}%)</GcdsText>
                  <GcdsText>{t('metrics.dashboard.aiScored.needsImprovement')}: {metrics.aiScored.needsImprovement} ({metrics.aiScored.total ? Math.round((metrics.aiScored.needsImprovement / metrics.aiScored.total) * 100) : 0}%)</GcdsText>
                  <GcdsText>{t('metrics.dashboard.aiScored.hasError')}: {metrics.aiScored.hasError} ({metrics.aiScored.total ? Math.round((metrics.aiScored.hasError / metrics.aiScored.total) * 100) : 0}%)</GcdsText>
                </div>
              </div>
              <div>
                <h3>{t('metrics.dashboard.userScored.title')}</h3>
                <GcdsText className="mb-300">{t('metrics.dashboard.userScored.description')}</GcdsText>
                <div>
                  <GcdsText>{t('metrics.dashboard.userScored.total')}: {metrics.userScored.total}</GcdsText>
                  <GcdsText>{t('metrics.dashboard.userScored.helpful')}: {metrics.userScored.helpful} ({metrics.userScored.total ? Math.round((metrics.userScored.helpful / metrics.userScored.total) * 100) : 0}%)</GcdsText>
                  <GcdsText>{t('metrics.dashboard.userScored.unhelpful')}: {metrics.userScored.unhelpful} ({metrics.userScored.total ? Math.round((metrics.userScored.unhelpful / metrics.userScored.total) * 100) : 0}%)</GcdsText>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-600">
              <h3 className="mb-300">{t('metrics.dashboard.byDepartment.title')}</h3>
              <DataTable
                data={Object.entries(metrics.byDepartment).map(([department, data]) => ({
                  department,
                  totalQuestions: data.total,
                  expertScoredTotal: data.expertScored.total,
                  expertScoredCorrect: data.expertScored.correct,
                  expertScoredNeedsImprovement: data.expertScored.needsImprovement,
                  expertScoredHasError: data.expertScored.hasError,
                  expertScoredHasErrorPercent: data.expertScored.total ? Math.round((data.expertScored.hasError / data.expertScored.total) * 100) : 0
                }))}
                columns={[
                  { title: t('metrics.dashboard.byDepartment.title'), data: 'department' },
                  { title: t('metrics.dashboard.byDepartment.totalQuestions'), data: 'totalQuestions' },
                  { title: t('metrics.dashboard.expertScored.total'), data: 'expertScoredTotal' },
                  { title: t('metrics.dashboard.expertScored.correct'), data: 'expertScoredCorrect' },
                  { title: t('metrics.dashboard.expertScored.needsImprovement'), data: 'expertScoredNeedsImprovement' },
                  { 
                    title: t('metrics.dashboard.expertScored.hasError'), 
                    data: 'expertScoredHasError',
                    render: (data, type, row) => {
                      if (type === 'display') {
                        return `${data} (${row.expertScoredHasErrorPercent}%)`;
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
            <GcdsText>
              Select a time range and click 'Get metrics' to view performance metrics
            </GcdsText>
          </div>
        )}
      </GcdsContainer>
    </GcdsContainer>
  );
};

export default MetricsDashboard; 