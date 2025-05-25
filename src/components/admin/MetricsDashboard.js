import React, { useState } from 'react';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import DataStoreService from '../../services/DataStoreService.js';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import ExportService from '../../services/ExportService.js';
DataTable.use(DT);

const MetricsDashboard = () => {
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
    // Initialize metrics object
    const metrics = {
      totalSessions: logs.length,
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

    // Process each log
    logs.forEach(log => {
      log.interactions?.forEach(interaction => {
        // Process human-scored metrics
        if (interaction.expertFeedback?.totalScore !== undefined) {
          metrics.humanScored.total++;
          const score = interaction.expertFeedback.totalScore;
          if (score === 100) {
            metrics.humanScored.correct++;
          } else if (score >= 82 && score <= 99) {
            metrics.humanScored.needsImprovement++;
          } else {
            metrics.humanScored.hasError++;
          }
        }

        // Process AI-scored metrics
        if (interaction.autoEval?.totalScore !== undefined) {
          metrics.aiScored.total++;
          const score = interaction.autoEval.totalScore;
          if (score === 100) {
            metrics.aiScored.correct++;
          } else if (score >= 82 && score <= 99) {
            metrics.aiScored.needsImprovement++;
          } else {
            metrics.aiScored.hasError++;
          }
        }

        // Process department metrics
        const department = interaction.context?.department || 'Unknown';
        if (!metrics.byDepartment[department]) {
          metrics.byDepartment[department] = 0;
        }
        metrics.byDepartment[department]++;
      });
    });

    return metrics;
  };

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
      </div>

      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-4">
            <p className="text-gray-500">Loading metrics...</p>
          </div>
        ) : metrics.totalSessions > 0 ? (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Human Scored Metrics</h3>
                <div className="space-y-2">
                  <p>Total: {metrics.humanScored.total}</p>
                  <p>Correct: {metrics.humanScored.correct}</p>
                  <p>Needs Improvement: {metrics.humanScored.needsImprovement}</p>
                  <p>Has Error: {metrics.humanScored.hasError}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">AI Scored Metrics</h3>
                <div className="space-y-2">
                  <p>Total: {metrics.aiScored.total}</p>
                  <p>Correct: {metrics.aiScored.correct}</p>
                  <p>Needs Improvement: {metrics.aiScored.needsImprovement}</p>
                  <p>Has Error: {metrics.aiScored.hasError}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Department Breakdown</h3>
              <DataTable
                data={Object.entries(metrics.byDepartment).map(([department, count]) => ({
                  department,
                  count
                }))}
                columns={[
                  { title: 'Department', data: 'department' },
                  { title: 'Total Sessions', data: 'count' }
                ]}
                options={{
                  paging: true,
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