import React, { useRef, useState } from 'react';
import { getApiUrl } from '../utils/apiToUrl.js';
import { GcdsContainer, GcdsText, GcdsButton } from '@cdssnc/gcds-components-react';
import AuthService from '../services/AuthService.js';

const DatabasePage = ({ lang }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDroppingIndexes, setIsDroppingIndexes] = useState(false);
  const [message, setMessage] = useState('');
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

      // Step 2: For each collection, fetch all documents in chunks
      const backup = {};
      const chunkSize = 1000;
      for (const collection of collections) {
        let allDocs = [];
        let skip = 0;
        let total = null;
        do {
          const url = getApiUrl(`db-database-management?collection=${encodeURIComponent(collection)}&skip=${skip}&limit=${chunkSize}`);
          const res = await fetch(url, { headers: AuthService.getAuthHeader() });
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Failed to export collection ${collection}`);
          }
          const { data, total: collectionTotal } = await res.json();
          if (total === null) total = collectionTotal;
          allDocs = allDocs.concat(data);
          skip += chunkSize;
        } while (total === null || allDocs.length < total);
        backup[collection] = allDocs;
      }

      // Step 3: Download assembled backup as JSON
      const filename = `database-backup-${new Date().toISOString()}.json`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

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

      const formData = new FormData();
      formData.append('backup', file);

      const response = await fetch(getApiUrl('db-database-management'), {
        method: 'POST',
        headers: AuthService.getAuthHeader(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import database');
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

  return (
    <GcdsContainer size="xl" centered>
      <h1>{lang === 'en' ? 'Database Management' : 'Gestion de la base de données'}</h1>

      <div className="mb-400">
        <h2>{lang === 'en' ? 'Export Database' : 'Exporter la base de données'}</h2>
        <GcdsText>
          {lang === 'en' 
            ? 'Download a complete backup of the database.'
            : 'Télécharger une sauvegarde complète de la base de données.'}
        </GcdsText>
        <GcdsButton
          onClick={handleExport}
          disabled={isExporting}
          className="mb-200"
        >
          {isExporting 
            ? (lang === 'en' ? 'Exporting...' : 'Exportation...')
            : (lang === 'en' ? 'Export Database' : 'Exporter la base de données')}
        </GcdsButton>
      </div>

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
            accept=".json"
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

      {message && (
        <div className={message.includes('failed') ? 'text-danger' : 'text-success'}>
          {message}
        </div>
      )}
    </GcdsContainer>
  );
};

export default DatabasePage;