import React, { useRef, useState } from 'react';
import { getApiUrl, getAbsoluteApiUrl } from '../utils/apiToUrl.js';
import { GcdsContainer, GcdsText, GcdsButton } from '@cdssnc/gcds-components-react';
import AuthService from '../services/AuthService.js';
import streamSaver from 'streamsaver';

const DatabasePage = ({ lang }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDroppingIndexes, setIsDroppingIndexes] = useState(false);
  const [isDeletingSystemLogs, setIsDeletingSystemLogs] = useState(false);
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setMessage('');

      // Step 1: Get list of collections
      const collectionsRes = await fetch(getApiUrl('db-database-management'), {
        method: 'GET',
        headers: AuthService.getAuthHeader()
      });
      if (!collectionsRes.ok) {
        const error = await collectionsRes.json();
        throw new Error(error.message || 'Failed to get collections');
      }
      const { collections } = await collectionsRes.json();
      if (!collections || !Array.isArray(collections)) {
        throw new Error('No collections found');
      }

      // Step 2: Stream each collection as it is fetched (JSONL format)
      const filename = `database-backup-${new Date().toISOString()}.jsonl`;
      const fileStream = streamSaver.createWriteStream(filename);
      const writer = fileStream.getWriter();
      const encoder = new TextEncoder();
      const initialChunkSize = 2000;
      const minChunkSize = 50;

      for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];
        let skip = 0;
        let total = null;
        let chunkSize = initialChunkSize;
        while (total === null || skip < total) {
          let success = false;
          let data = [];
          let collectionTotal = null;
          while (!success && chunkSize >= minChunkSize) {
            try {
              // Add date range and always use updatedAt
              let url = getApiUrl(`db-database-management?collection=${encodeURIComponent(collection)}&skip=${skip}&limit=${chunkSize}`);
              if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
              if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
              url += `&dateField=updatedAt`;
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 25000);
              const res = await fetch(url, { headers: AuthService.getAuthHeader(), signal: controller.signal });
              clearTimeout(timeout);
              if (!res.ok) {
                let errorMsg = `Failed to export collection ${collection}`;
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  const error = await res.json();
                  errorMsg = error.message || errorMsg;
                } else {
                  const text = await res.text();
                  errorMsg = text || errorMsg;
                }
                throw new Error(errorMsg);
              }
              const json = await res.json();
              data = json.data;
              collectionTotal = json.total;
              success = true;
            } catch (err) {
              // Retry on any error until minChunkSize is reached
              if (chunkSize > minChunkSize) {
                chunkSize = Math.floor(chunkSize / 2);
                if (chunkSize < minChunkSize) chunkSize = minChunkSize;
              } else {
                throw new Error(`Export failed for collection ${collection} at min chunk size (${minChunkSize}): ${err.message}`);
              }
            }
          }
          if (total === null) total = collectionTotal;
          // Write each document as a JSONL line: {"collection": "name", "doc": {...}}
          for (let j = 0; j < data.length; j++) {
            const docStr = JSON.stringify({ collection, doc: data[j] });
            await writer.write(encoder.encode(docStr + '\n'));
          }
          skip += chunkSize;
        }
      }
      await writer.close();
      setMessage('Database exported successfully');
    } catch (error) {
      setMessage(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage('Please select a file to import');
      return;
    }

    try {
      setIsImporting(true);
      setMessage('');

      const chunkSize = 5 * 1024 * 1024; // 5MB per chunk
      const totalChunks = Math.ceil(file.size / chunkSize);
      const fileName = file.name;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', chunkIndex);
        formData.append('totalChunks', totalChunks);
        formData.append('fileName', fileName);

        const response = await fetch(getApiUrl('db-database-management'), {
          method: 'POST',
          headers: AuthService.getAuthHeader(),
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || `Failed to upload chunk ${chunkIndex + 1}`);
        }

        setMessage(`Uploaded chunk ${chunkIndex + 1} of ${totalChunks}`);
      }

      setMessage('Database imported successfully');
      fileInputRef.current.value = '';
    } catch (error) {
      setMessage(`Import failed: ${error.message}`);
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDropIndexes = async () => {
    const confirmed = window.confirm(
      lang === 'en'
        ? 'This will drop all database indexes. Database operations may be slower until indexes are rebuilt automatically. Are you sure you want to continue?'
        : 'Cette action supprimera tous les index de la base de données. Les opérations de base de données peuvent être plus lentes jusqu\'à ce que les index soient reconstruits automatiquement. Êtes-vous sûr de vouloir continuer?'
    );
    
    if (!confirmed) return;
    
    try {
      setIsDroppingIndexes(true);
      setMessage('');

      const response = await fetch(getApiUrl('db-database-management'), {
        method: 'DELETE',
        headers: AuthService.getAuthHeader()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to drop indexes');
      }

      const result = await response.json();
      setMessage(lang === 'en' 
        ? `Indexes dropped successfully for ${result.results.success.length} collections`
        : `Indexes supprimés avec succès pour ${result.results.success.length} collections`
      );
    } catch (error) {
      setMessage(lang === 'en' 
        ? `Drop indexes failed: ${error.message}`
        : `Échec de la suppression des index: ${error.message}`
      );
      console.error('Drop indexes error:', error);
    } finally {
      setIsDroppingIndexes(false);
    }
  };

  const handleDeleteSystemLogs = async () => {
    if (!window.confirm(
      lang === 'en'
        ? 'Are you sure you want to delete all logs with chatId = "system"? This cannot be undone.'
        : 'Êtes-vous sûr de vouloir supprimer tous les journaux avec chatId = "system" ? Cette action est irréversible.'
    )) return;
    setIsDeletingSystemLogs(true);
    setMessage('');
    try {
      const response = await fetch(getApiUrl('db-delete-system-logs'), {
        method: 'DELETE',
        headers: AuthService.getAuthHeader(),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to delete system logs');
      setMessage(
        (lang === 'en'
          ? `Deleted ${result.deletedCount} system logs.`
          : `Supprimé ${result.deletedCount} journaux système.`)
      );
    } catch (error) {
      setMessage(
        lang === 'en'
          ? `Delete system logs failed: ${error.message}`
          : `Échec de la suppression des journaux système: ${error.message}`
      );
    } finally {
      setIsDeletingSystemLogs(false);
    }
  };

  return (
    <GcdsContainer  size="xl" centered>
      <GcdsText tag="h2">Database Management</GcdsText>
      <div style={{ marginBottom: 16 }}>
        <label>Start date:&nbsp;
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </label>
        &nbsp;&nbsp;
        <label>End date:&nbsp;
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </label>
      </div>
      <GcdsButton onClick={handleExport} disabled={isExporting}>
        {isExporting ? 'Exporting...' : 'Export Database'}
      </GcdsButton>
      <div className="mb-400">
        <h2>{lang === 'en' ? 'Import Database' : 'Importer la base de données'}</h2>
        <GcdsText>
          {lang === 'en'
            ? 'Restore the database from a backup file. Warning: This will replace all existing data.'
            : 'Restaurer la base de données à partir d\'un fichier de sauvegarde. Avertissement : Cela remplacera toutes les données existantes.'}
        </GcdsText>
        <form onSubmit={handleImport} className="mb-200">
          <input
            type="file"
            accept=".jsonl"
            ref={fileInputRef}
            className="mb-200"
            style={{ display: 'block' }}
          />
          <GcdsButton
            type="submit"
            disabled={isImporting}
            variant="secondary"
          >
            {isImporting 
              ? (lang === 'en' ? 'Importing...' : 'Importation...')
              : (lang === 'en' ? 'Import Database' : 'Importer la base de données')}
          </GcdsButton>
        </form>
      </div>

      <div className="mb-400">
        <h2>{lang === 'en' ? 'Drop All Indexes' : 'Supprimer tous les index'}</h2>
        <GcdsText>
          {lang === 'en'
            ? 'Remove all database indexes. This can be useful to fix database performance issues. Indexes will be automatically rebuilt by MongoDB as needed.'
            : 'Supprimer tous les index de la base de données. Cela peut être utile pour résoudre les problèmes de performance de la base de données. Les index seront reconstruits automatiquement par MongoDB selon les besoins.'}
        </GcdsText>
        <GcdsButton
          onClick={handleDropIndexes}
          disabled={isDroppingIndexes}
          variant="danger"
          className="mb-200"
        >
          {isDroppingIndexes 
            ? (lang === 'en' ? 'Dropping Indexes...' : 'Suppression des index...')
            : (lang === 'en' ? 'Drop All Indexes' : 'Supprimer tous les index')}
        </GcdsButton>
      </div>

       <div className="mb-400">
        <h2>{lang === 'en' ? 'Delete All Batches' : 'Supprimer tous les lots'}</h2>
        <GcdsText>
          {lang === 'en'
            ? 'Delete all batches and their related chats (cascading delete). This action cannot be undone.'
            : 'Supprimez tous les lots et leurs discussions associées (suppression en cascade). Cette action est irréversible.'}
        </GcdsText>
        <GcdsButton
          onClick={async () => {
            if (!window.confirm(lang === 'en' ? 'Are you sure you want to delete ALL batches and their related chats? This cannot be undone.' : 'Êtes-vous sûr de vouloir supprimer TOUS les lots et leurs discussions associées ? Cette action est irréversible.')) return;
            setMessage('');
            setIsExporting(true);
            try {
              const response = await fetch(getAbsoluteApiUrl('/api/batch/delete-all'), {
                method: 'DELETE',
                headers: AuthService.getAuthHeader(),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || result.message || 'Failed to delete batches');
              setMessage(result.message || (lang === 'en' ? 'All batches deleted.' : 'Tous les lots ont été supprimés.'));
            } catch (error) {
              setMessage((lang === 'en' ? 'Delete batches failed: ' : 'Échec de la suppression des lots : ') + error.message);
            } finally {
              setIsExporting(false);
            }
          }}
          disabled={isExporting}
          variant="danger"
          className="mb-200"
        >
          {isExporting
            ? (lang === 'en' ? 'Deleting...' : 'Suppression...')
            : (lang === 'en' ? 'Delete All Batches' : 'Supprimer tous les lots')}
        </GcdsButton>
      </div>

      <div className="mb-400">
        <h2>{lang === 'en' ? 'Delete All Batches' : 'Supprimer tous les lots'}</h2>
        <GcdsText>
          {lang === 'en'
            ? 'Delete all batches and their related chats (cascading delete). This action cannot be undone.'
            : 'Supprimez tous les lots et leurs discussions associées (suppression en cascade). Cette action est irréversible.'}
        </GcdsText>
        <GcdsButton
          onClick={async () => {
            if (!window.confirm(lang === 'en' ? 'Are you sure you want to delete ALL batches and their related chats? This cannot be undone.' : 'Êtes-vous sûr de vouloir supprimer TOUS les lots et leurs discussions associées ? Cette action est irréversible.')) return;
            setMessage('');
            setIsExporting(true);
            try {
              const response = await fetch(getAbsoluteApiUrl('/api/batch/delete-all'), {
                method: 'DELETE',
                headers: AuthService.getAuthHeader(),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || result.message || 'Failed to delete batches');
              setMessage(result.message || (lang === 'en' ? 'All batches deleted.' : 'Tous les lots ont été supprimés.'));
            } catch (error) {
              setMessage((lang === 'en' ? 'Delete batches failed: ' : 'Échec de la suppression des lots : ') + error.message);
            } finally {
              setIsExporting(false);
            }
          }}
          disabled={isExporting}
          variant="danger"
          className="mb-200"
        >
          {isExporting
            ? (lang === 'en' ? 'Deleting...' : 'Suppression...')
            : (lang === 'en' ? 'Delete All Batches' : 'Supprimer tous les lots')}
        </GcdsButton>
      </div>

      <div className="mb-400">
        <h2>{lang === 'en' ? 'Delete System Logs' : 'Supprimer les journaux système'}</h2>
        <GcdsText>
          {lang === 'en'
            ? 'Delete all logs where chatId = "system". This action cannot be undone.'
            : 'Supprimez tous les journaux où chatId = "system". Cette action est irréversible.'}
        </GcdsText>
        <GcdsButton
          onClick={handleDeleteSystemLogs}
          disabled={isDeletingSystemLogs}
          variant="danger"
          className="mb-200"
        >
          {isDeletingSystemLogs
            ? (lang === 'en' ? 'Deleting...' : 'Suppression...')
            : (lang === 'en' ? 'Delete System Logs' : 'Supprimer les journaux système')}
        </GcdsButton>
      </div>

      {message && <div style={{ marginTop: 16, color: 'blue' }}>{message}</div>}
    </GcdsContainer>
  );
};

export default DatabasePage;