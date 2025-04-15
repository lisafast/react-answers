import React, { useState, useEffect, useCallback } from 'react';
import { GcdsContainer, GcdsHeading, GcdsCheckbox, GcdsTextarea, GcdsButton, GcdsAlert } from '@cdssnc/gcds-components-react';
import { useTranslations } from '../hooks/useTranslations.js';
import { usePageContext } from '../hooks/usePageParam.js';
import AuthService from '../services/AuthService.js'; // Needed for auth token
import { getAbsoluteApiUrl } from '../utils/apiToUrl.js'; // Import the new helper

const PromptsPage = () => {
  const { t } = useTranslations();
  const { language } = usePageContext();

  // State for the list of prompts fetched from API
  const [basePrompts, setBasePrompts] = useState([]); // Array of { filename, hasOverride, isActive }
  const [scenarioPrompts, setScenarioPrompts] = useState([]);
  // State for prompt content (filename -> string)
  const [promptContents, setPromptContents] = useState({});
  // State for loading status (global and per-prompt)
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [loadingStates, setLoadingStates] = useState({}); // filename -> boolean
  // State for error status (global and per-prompt)
  const [listError, setListError] = useState(null);
  const [errorStates, setErrorStates] = useState({}); // filename -> string
  // State for save status
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  // State to track which textareas have unsaved changes
  const [dirtyState, setDirtyState] = useState({}); // filename -> boolean

  // Fetch the list of prompts on mount
  const fetchPromptList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const apiUrl = getAbsoluteApiUrl('/api/prompts/list');
      let data = await AuthService.fetchWithAuth(apiUrl);
      setBasePrompts(data.basePrompts || []);
      setScenarioPrompts(data.scenarioPrompts || []);

      const allPrompts = [...(data.basePrompts || []), ...(data.scenarioPrompts || [])];
      const activePrompts = allPrompts.filter(p => p.isActive);
      await Promise.all(activePrompts.map(p => fetchPromptContent(p.filename)));
    } catch (error) {
      setListError(t('prompts.errorList', 'Failed to load prompt list.'));
      console.error("Error fetching prompt list:", error);
    } finally {
      setIsLoadingList(false);
    }
  }, [t]); // Add t to dependency array

  useEffect(() => {
    fetchPromptList();
  }, [fetchPromptList]); // Run fetchPromptList on mount

  // Fetch content for a specific prompt
  const fetchPromptContent = useCallback(async (filename) => {
    setLoadingStates(prev => ({ ...prev, [filename]: true }));
    setErrorStates(prev => ({ ...prev, [filename]: null }));
    try {
      const apiUrl = getAbsoluteApiUrl(`/api/prompts/get`);
      const content = await AuthService.fetchWithAuth(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ filename }),
      });
      setPromptContents(prev => ({ ...prev, [filename]: content }));
      setDirtyState(prev => ({ ...prev, [filename]: false })); // Mark as clean after fetch
    } catch (error) {
      setErrorStates(prev => ({ ...prev, [filename]: t('prompts.errorContent', 'Failed to load content.') }));
      console.error(`Error fetching content for ${filename}:`, error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [filename]: false }));
    }
  }, [t]); // Add t to dependency array

  // Handler for checkbox changes (toggles isActive status)
  const handleCheckboxChange = async (event) => {
    // Use event.detail.checked for GcdsCheckbox
    const filename = event.target.name;
    const newIsActive = event.detail;
    let originalPromptState = null;

    // Optimistically update UI state for checkbox
    setBasePrompts(prevList => {
      const newList = prevList.map(p => {
        if (p.filename === filename) {
          originalPromptState = { ...p }; // Store original state for potential revert
          // Assume override exists or will be created when activating
          return { ...p, isActive: newIsActive, hasOverride: newIsActive ? true : p.hasOverride };
        }
        return p;
      });
      return newList;
    });
    setErrorStates(prev => ({ ...prev, [filename]: null })); // Clear previous error

    try {
      // Call API to update status
      const apiUrl = getAbsoluteApiUrl(`/api/prompts/status`);
      await AuthService.fetchWithAuth(apiUrl, {
        method: 'PATCH',
        body: JSON.stringify({ filename, isActive: newIsActive }),
      });

      // If activating and content not loaded, fetch it
      if (newIsActive && !promptContents[filename]) {
        await fetchPromptContent(filename);
      }
      // If deactivating, maybe clear content? Optional.
      // if (!newIsActive) { // Use newIsActive here too if uncommented
      //   setPromptContents(prev => ({ ...prev, [filename]: undefined }));
      // }

    } catch (error) {
      setErrorStates(prev => ({ ...prev, [filename]: t('prompts.errorStatus', 'Failed to update status.') }));
      console.error(`Error updating status for ${filename}:`, error);
      // Revert optimistic UI update on error using the stored original state
      if (originalPromptState) {
        setBasePrompts(prevList =>
          prevList.map(p =>
            p.filename === filename ? originalPromptState : p
          )
        );
      }
    }
  };

  // Handler for textarea changes
  const handleTextareaChange = (event) => {
    const { name: filename, value } = event.target;
    setPromptContents(prev => ({ ...prev, [filename]: value }));
    setDirtyState(prev => ({ ...prev, [filename]: true })); // Mark as dirty
    setSaveSuccess(null); // Clear success message on new change
    setSaveError(null); // Clear error message on new change
  };

  // Handler for saving changes
  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    let successCount = 0;
    let errorCount = 0;

    const filenamesToSave = Object.keys(dirtyState).filter(filename => dirtyState[filename]);

    if (filenamesToSave.length === 0) {
      setSaveSuccess(t('prompts.noChanges', 'No changes to save.'));
      setIsSaving(false);
      return;
    }

    const savePromises = filenamesToSave.map(async (filename) => {
      const content = promptContents[filename];
      if (typeof content === 'string') { // Ensure content exists
        try {
          const apiUrl = getAbsoluteApiUrl(`/api/prompts/save`);
          await AuthService.fetchWithAuth(apiUrl, {
            method: 'PUT',
            body: JSON.stringify({ filename, content }),
          });
          setDirtyState(prev => ({ ...prev, [filename]: false })); // Mark as clean after successful save
          successCount++;
        } catch (error) {
          setErrorStates(prev => ({ ...prev, [filename]: t('prompts.errorSave', 'Failed to save.') }));
          console.error(`Error saving ${filename}:`, error);
          errorCount++;
        }
      }
    });

    await Promise.all(savePromises);

    setIsSaving(false);
    if (errorCount > 0) {
      setSaveError(t('prompts.saveErrorCount', `Failed to save ${errorCount} prompt(s). Check individual errors.`));
    } else if (successCount > 0) {
      setSaveSuccess(t('prompts.saveSuccessCount', `Successfully saved ${successCount} prompt(s).`));
    }
    // Refetch list to ensure hasOverride status is up-to-date after saves
    await fetchPromptList();
  };

  // Handler for deleting an override
  const handleDeleteOverride = async (filename) => {
     if (!window.confirm(t('prompts.confirmDelete', `Are you sure you want to delete the override for ${filename}? This will revert it to the default prompt.`))) {
       return;
     }
     setLoadingStates(prev => ({ ...prev, [filename]: true })); // Indicate loading
     setErrorStates(prev => ({ ...prev, [filename]: null }));
     try {
        const apiUrl = getAbsoluteApiUrl(`/api/prompts/delete`);
        await AuthService.fetchWithAuth(apiUrl, { 
          method: 'DELETE',
          body: JSON.stringify({ filename }),
        });
        // Update UI state after successful deletion
        setPromptContents(prev => {
           const newState = { ...prev };
           delete newState[filename]; // Remove content
           return newState;
        });
        setDirtyState(prev => {
           const newState = { ...prev };
           delete newState[filename]; // Remove dirty state
           return newState;
        });
        setBasePrompts(prevList =>
           prevList.map(p =>
             p.filename === filename ? { ...p, hasOverride: false, isActive: false } : p
           )
        );
        alert(t('prompts.deleteSuccess', `Override for ${filename} deleted.`));
     } catch (error) {
        setErrorStates(prev => ({ ...prev, [filename]: t('prompts.errorDelete', 'Failed to delete override.') }));
        console.error(`Error deleting override for ${filename}:`, error);
     } finally {
        setLoadingStates(prev => ({ ...prev, [filename]: false }));
     }
  };

  // Helper to render a prompt block
  const renderPromptBlock = ({ filename, hasOverride, isActive }) => (
    <div key={filename} className="mb-400" style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
         <GcdsCheckbox
           checkboxId={`checkbox-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`}
           label={`${filename} ${hasOverride ? '(Override Exists)' : '(Default)'}`}
           name={filename}
           checked={isActive}
           disabled={loadingStates[filename]}
           onGcdsChange={handleCheckboxChange}
         />
         {hasOverride && (
            <GcdsButton
               size="small"
               buttonRole="danger"
               onClick={() => handleDeleteOverride(filename)}
               disabled={loadingStates[filename]}
            >
               {t('prompts.deleteButton', 'Delete Override')}
            </GcdsButton>
         )}
      </div>
      {isActive && (
        <div className="mt-300">
          {loadingStates[filename] ? (
            <p>{t('prompts.loading', 'Loading...')}</p>
          ) : errorStates[filename] ? (
            <GcdsAlert heading={t('prompts.errorContentTitle', 'Content Error')} alertType="danger" size="small">{errorStates[filename]}</GcdsAlert>
          ) : (
            <GcdsTextarea
              textareaId={`textarea-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`}
              label={`Edit: ${filename}`}
              hideLabel
              name={filename}
              value={promptContents[filename] ?? ''}
              onGcdsChange={handleTextareaChange}
              rows={15}
              style={{ width: '100%' }}
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <GcdsContainer size="xl" centered tag="main" className="mb-600">
      <GcdsHeading tag="h1" className="mb-400">{t('prompts.title', 'Manage System Prompts')}</GcdsHeading>

      {listError && <GcdsAlert heading={t('prompts.errorListTitle', 'Error Loading Prompts')} alertType="danger">{listError}</GcdsAlert>}
      {saveSuccess && <GcdsAlert heading={t('prompts.saveSuccessTitle', 'Save Successful')} alertType="success" hideCloseBtn>{saveSuccess}</GcdsAlert>}
      {saveError && <GcdsAlert heading={t('prompts.saveErrorTitle', 'Save Error')} alertType="danger">{saveError}</GcdsAlert>}

      <div className="mb-400">
        <GcdsButton onClick={handleSaveChanges} disabled={isLoadingList || isSaving}>
          {isSaving ? t('prompts.saving', 'Saving...') : t('prompts.saveButton', 'Save Changes')}
        </GcdsButton>
      </div>

      {isLoadingList ? (
        <p>{t('prompts.loadingList', 'Loading prompt list...')}</p>
      ) : (
        <div>
          {/* Main prompts in build order */}
          {basePrompts.map(renderPromptBlock)}

          {/* Scenarios section */}
          {scenarioPrompts.length > 0 && (
            <>
              <hr style={{ margin: '2rem 0' }} />
              <GcdsHeading tag="h2" className="mt-600 mb-400">{t('prompts.scenariosSection', 'Scenarios')}</GcdsHeading>
              {scenarioPrompts.map(renderPromptBlock)}
            </>
          )}
        </div>
      )}

      <div className="mt-400">
        <GcdsButton onClick={handleSaveChanges} disabled={isLoadingList || isSaving}>
          {isSaving ? t('prompts.saving', 'Saving...') : t('prompts.saveButton', 'Save Changes')}
        </GcdsButton>
      </div>
    </GcdsContainer>
  );
};

export default PromptsPage;
