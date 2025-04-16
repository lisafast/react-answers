import React, { useState, useEffect, useRef } from 'react';
import { GcdsContainer, GcdsText, GcdsLink, GcdsButton } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';
import { usePageContext } from '../hooks/usePageParam.js';
import $ from 'jquery';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-xml-doc.js';
import DataStoreService from '../services/DataStoreService.js';

const ChatViewer = () => {
  const { t } = useTranslations();
  const { language } = usePageContext();
  const [chatId, setChatId] = useState('');
  const [logs, setLogs] = useState([]);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  const tableRef = useRef(null);
  const dataTableRef = useRef(null);
  const [expandedMetadata, setExpandedMetadata] = useState(null);

  // Auto-refresh once on initial mount
  useEffect(() => {
    const storedChatId = localStorage.getItem('chatId');
    if (storedChatId) {
      setChatId(storedChatId);
    }
  }, []);

  // DataTable initialization and update
  useEffect(() => {
    if (logs?.length > 0 && tableRef.current) {
      // Ensure we clean up any existing DataTable before creating a new one
      if (dataTableRef.current) {
        dataTableRef.current.destroy();
        dataTableRef.current = null;
      }

      // Initialize DataTable
      dataTableRef.current = $(tableRef.current).DataTable({
        data: logs, // Directly provide data during initialization
        columns: [
          {
            title: 'Created At',
            data: 'createdAt',
            render: (data) => {
              const date = new Date(data);
              return date.toLocaleString();
            },
          },
          {
            title: 'Level',
            data: 'logLevel',
            render: (data) => data ?? '',
          },
          {
            title: 'Message',
            data: 'message',
            render: (data) => data ?? '',
          },
          {
            title: 'Metadata',
            data: 'metadata',
            className: 'metadata-column',

            render: (data) => {
              if (!data) {
                data = {}; // Default to empty object for consistent formatting
              }

              try {
                let formattedContent = '';
                let isXML = false;

                if (typeof data === 'string') {
                  // Check if it looks like XML
                  if (data.trim().startsWith('<') && data.trim().endsWith('>')) {
                    isXML = true;
                    formattedContent = data.replace(/></g, '>\n<').replace(/\s+/g, ' ').trim();
                  } else {
                    // Try parsing as JSON if it's not XML
                    try {
                      const parsed = JSON.parse(data);
                      formattedContent = JSON.stringify(parsed, null, 2);
                    } catch {
                      formattedContent = data;
                    }
                  }
                } else {
                  formattedContent = JSON.stringify(data, null, 2);
                }

                const escapedContent = formattedContent
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');

                // Wrap content in a scrollable container
                return `
                  <div class="metadata-wrapper">
                    <div class="metadata-content">
                      <pre><code class="language-${isXML ? 'xml' : 'json'}">${escapedContent}</code></pre>
                    </div>
                    <div class="metadata-actions">
                      <button class="expand-button gcds-button gcds-button--secondary">
                        Expand
                      </button>
                    </div>
                  </div>`;
              } catch (e) {
                console.error('Error formatting metadata:', e);
                return String(data);
              }
            },
          },
        ],
        order: [[0, 'desc']],
        scrollX: true, // Enable horizontal scrolling for the whole table
        // Add styling options for the table
        drawCallback: function () {
          Prism.highlightAll();

          // Update styling for metadata containers
          $('.metadata-wrapper').css({
            position: 'relative',
            'min-height': '50px',
            'max-height': '200px',
            display: 'flex',
            'flex-direction': 'column',
            width: '750px', // Match the column width
          });

          $('.metadata-content').css({
            flex: '1',
            'overflow-y': 'auto',
            'overflow-x': 'auto',
            position: 'relative',
            'background-color': '#f5f5f5',
            'border-radius': '4px',
            'max-width': '900px', // Match the column width
          });

          $('.metadata-content pre').css({
            margin: '0',
            padding: '8px',
            'min-width': 'fit-content',
            width: 'max-content',
          });

          $('.metadata-content code').css({
            'font-family': 'monospace',
            'font-size': '13px',
            'line-height': '1.4',
            'white-space': 'pre',
          });

          $('.metadata-actions').css({
            padding: '4px 0',
            'text-align': 'right',
          });

          $('.expand-button').css({
            'margin-top': '4px',
            'font-size': '14px',
            padding: '4px 8px',
          });

          // Add click handler for expand buttons
          $('.expand-button')
            .off('click')
            .on('click', function (e) {
              e.stopPropagation();
              const rowIdx = $(this).closest('tr').index();
              const rowData = dataTableRef.current.row(rowIdx).data();
              setExpandedMetadata(rowData.metadata);
            });
        },
      });

      // No need to add rows here as we're providing the data during initialization
    }

    return () => {
      if (dataTableRef.current) {
        dataTableRef.current.destroy();
        dataTableRef.current = null;
      }
    };
  }, [logs]);

  const handleChatIdChange = (e) => {
    const newValue = e.target ? e.target.value : e;

    // If chat ID changes, stop polling and clear the data table
    if (newValue !== chatId) {
      if (isPolling && pollingInterval) {
        console.log('Stopping polling due to chat ID change');
        clearInterval(pollingInterval);
        setIsPolling(false);
        setPollingInterval(null);
      }

      // Properly cleanup DataTable before clearing logs
      if (dataTableRef.current) {
        console.log('Destroying DataTable instance before changing chat ID');
        dataTableRef.current.destroy();
        dataTableRef.current = null;
      }

      // Clear logs when chat ID changes
      setLogs([]);
    }

    setChatId(newValue);
  };

  // Explicitly refresh the chat ID from localStorage when button is clicked
  const handleRefreshChatId = () => {
    console.log('Refreshing chat ID from localStorage');
    const storedChatId = localStorage.getItem('chatId');
    if (storedChatId) {
      console.log('Found chat ID in localStorage:', storedChatId);
      setChatId(storedChatId);
    } else {
      console.log('No chat ID found in localStorage');
    }
  };

  const fetchLogs = async () => {
    if (!chatId) {
      console.log('No chat ID available, cannot fetch logs');
      return;
    }

    console.log('Fetching logs for chat ID:', chatId);
    try {
      const data = await DataStoreService.getLogs(chatId);
      console.log('Logs fetched successfully:', data.logs?.length || 0, 'entries');
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
    }
  };

  const handleStartStopLogging = () => {
    const newIsPolling = !isPolling;
    console.log(newIsPolling ? 'Starting' : 'Stopping', 'logging with chat ID:', chatId);
    setIsPolling(newIsPolling);

    if (!newIsPolling && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      return;
    }

    // Initial fetch if we're starting polling - uses whatever ID is currently in the input
    if (newIsPolling) {
      fetchLogs(); // Uses current chatId state value
      const interval = setInterval(fetchLogs, 5000);
      setPollingInterval(interval);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  useEffect(() => {
    // Control body scroll when modal is open
    if (expandedMetadata) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [expandedMetadata]);

  return (
    <>
      <GcdsContainer size="xl" mainContainer centered tag="main" className="mb-600">
        <h1 className="mb-400">{t('logging.title')}</h1>
        <nav className="mb-400">
          <GcdsText>
            <GcdsLink href={`/${language}/admin`}>Back to Admin</GcdsLink>
          </GcdsText>
        </nav>

        <section className="mb-600">
          <div className="mb-400">
            <div className="">
              <label htmlFor="chatIdInput" className="block mb-2">
                Enter Chat ID:
              </label>
              <input
                id="chatIdInput"
                name="chatId"
                type="text"
                value={chatId}
                onChange={handleChatIdChange}
                required
                className="form-control p-2 border rounded w-full"
              />
            </div>
            <GcdsButton type="button" onClick={handleRefreshChatId} className="mt-4">
              Refresh Chat ID from localStorage
            </GcdsButton>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4 items-center">
              <GcdsButton
                type="button"
                disabled={!chatId}
                onClick={handleStartStopLogging}
              >
                {isPolling ? t('logging.pause') : t('logging.start')}
              </GcdsButton>
              {isPolling && (
                <div className="text-green-600 font-medium">
                  Polling active for chat ID: {chatId}
                </div>
              )}
            </div>

            {chatId && logs && (
              <div className="bg-white shadow rounded-lg">
                {logs?.length > 0 ? (
                  <div className="p-4">
                    <table ref={tableRef} className="display">
                      <thead>
                        <tr>
                          <th>Created At</th>
                          <th>Level</th>
                          <th>Message</th>
                          <th>Metadata</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-gray-500">No logs available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </GcdsContainer>

      {/* Modal for expanded metadata */}
      {expandedMetadata && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '2rem',
          }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
            style={{ position: 'relative' }}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Metadata Details</h2>
              <GcdsButton
                type="button"
                variant="secondary"
                onClick={() => setExpandedMetadata(null)}
              >
                Close
              </GcdsButton>
            </div>
            <div className="p-6 overflow-auto flex-grow">
              <pre
                className="whitespace-pre-wrap break-words"
                style={{ maxWidth: '100%', fontSize: '14px', lineHeight: '1.5' }}
              >
                <code
                  className={`language-${
                    typeof expandedMetadata === 'string' &&
                    expandedMetadata.trim().startsWith('<') &&
                    expandedMetadata.trim().endsWith('>')
                      ? 'xml'
                      : 'json'
                  }`}
                >
                  {typeof expandedMetadata === 'string'
                    ? expandedMetadata.replace(/\\n/g, '\n')
                    : JSON.stringify(expandedMetadata || {}, null, 2).replace(/\\n/g, '\n')}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatViewer;
