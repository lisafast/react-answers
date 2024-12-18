import React, { useState } from 'react';
import { GcdsButton } from '@cdssnc/gcds-components-react';
import '../../styles/App.css';
import AdminCodeInput from './AdminCodeInput.js';

const ChatLogsDashboard = () => {
  const [timeRange, setTimeRange] = useState('1');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const correctAdminCode = 'noPII';

  const fetchLogs = async () => {
    if (adminCode !== correctAdminCode) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/chat-logs?days=' + timeRange);
      const data = await response.json();
      console.log('API Response:', data);
      
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

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { 
      type: 'application/json' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const columns = [
      'timestamp',
      'redactedQuestion',
      'aiService',
      'confidenceRating',
      'citationUrl',
      'originalCitationUrl',
      'sentence1',
      'sentence2',
      'sentence3',
      'sentence4',
      'referringUrl',
      'feedback',
      'expertFeedback.totalScore',
      'expertFeedback.sentence1Score',
      'expertFeedback.sentence2Score',
      'expertFeedback.sentence3Score',
      'expertFeedback.sentence4Score',
      'expertFeedback.citationScore',
      'expertFeedback.answerImprovement',
      'expertFeedback.expertCitationUrl'
    ];

    // Create CSV header
    const header = columns.map(column => {
      return column.includes('.') ? column.split('.')[1] : column;
    }).join(',');

    const extractResponseData = (aiResponse) => {
      const data = {
        sentences: {
          sentence1: '',
          sentence2: '',
          sentence3: '',
          sentence4: ''
        }
      };

      if (!aiResponse) return data;

      // Extract sentences
      if (aiResponse.includes('<s-')) {
        const matches = aiResponse.match(/<s-(\d)>(.*?)<\/s-\1>/g);
        if (matches) {
          matches.forEach((match, index) => {
            if (index < 4) {
              const content = match.replace(/<\/?s-\d>/g, '').trim();
              data.sentences[`sentence${index + 1}`] = content;
            }
          });
        }
      } else {
        data.sentences.sentence1 = aiResponse.trim();
      }

      return data;
    };

    // Create CSV rows
    const rows = logs.map(log => {
      const extractedData = extractResponseData(log.aiResponse);
      
      return columns.map(column => {
        let value = '';
        if (column.includes('.')) {
          const [parent, child] = column.split('.');
          value = log[parent]?.[child] || '';
        } else if (column.startsWith('sentence')) {
          value = extractedData.sentences[column] || '';
        } else if (column === 'confidenceRating') {
          value = log.confidenceRating || '';
        } else if (column === 'citationUrl') {
          value = log.citationUrl || '';
        } else if (column === 'originalCitationUrl') {
          value = log.originalCitationUrl || '';
        } else {
          value = log[column] || '';
        }
        const escapedValue = value.toString().replace(/"/g, '""');
        return `"${escapedValue}"`;
      }).join(',');
    });

    // Combine header and rows
    const csv = [header, ...rows].join('\n');

    // Add UTF-8 BOM and create blob
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    
    // Create and download file
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-logs-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleAdminCodeChange = (e) => {
    setAdminCode(e.target.value);
  };

  return (
    <div className="space-y-6">
      <AdminCodeInput
        code={adminCode}
        onChange={handleAdminCodeChange}
        correctCode={correctAdminCode}
        label="Enter Admin Code to view chat logs:"
      />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <label 
            htmlFor="timeRange" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
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
          </select>
        </div>

        <GcdsButton 
          onClick={fetchLogs}
          disabled={loading || adminCode !== correctAdminCode}
          className="me-400 hydrated mrgn-tp-1r"
        >
          {loading ? 'Loading...' : 'Get logs'}
        </GcdsButton>
        
        {logs.length > 0 && adminCode === correctAdminCode && (
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
          </>
        )}
      </div>

      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-4">
            <p className="text-gray-500">Loading logs...</p>
          </div>
        ) : logs.length > 0 ? (
          <div className="p-4">
            <p className="mb-4 text-gray-600">Found {logs.length} chat interactions. Download the logs to see the full set and details.</p>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Query
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Response Length
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {(log.redactedQuestion || '').substring(0, 50)}...
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {(log.aiResponse || '').length} chars
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-gray-500">Select a time range and click 'Get logs' to view chat history</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatLogsDashboard;