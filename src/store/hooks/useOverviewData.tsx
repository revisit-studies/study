import { useCallback, useEffect, useState } from 'react';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { OverviewData } from '../../analysis/individualStudy/summary/types';
import { showNotification } from '../../utils/notifications';

export function useOverviewData(studyId: string) {
  const { storageEngine } = useStorageEngine();
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadOverviewData = useCallback(async () => {
    if (!storageEngine || !studyId) return;

    setLoading(true);
    try {
      const data = await storageEngine.getOverviewData(studyId);
      setOverviewData(data);
    } catch (error) {
      console.error('Failed to load overview data:', error);
    } finally {
      setLoading(false);
    }
  }, [storageEngine, studyId]);

  const saveOverviewData = useCallback(async (data: OverviewData) => {
    if (!storageEngine || !studyId) return;

    try {
      const currentCounts = await storageEngine.getParticipantsStatusCounts(studyId);

      if (
        data.participantCounts.completed !== currentCounts.completed
        || data.participantCounts.inProgress !== currentCounts.inProgress
        || data.participantCounts.rejected !== currentCounts.rejected
      ) {
        showNotification({
          title: 'Participant Count Mismatch',
          message: `Calculated participant counts don't match current counts. Completed: ${data.participantCounts.completed} vs ${currentCounts.completed}, In Progress: ${data.participantCounts.inProgress} vs ${currentCounts.inProgress}, Rejected: ${data.participantCounts.rejected} vs ${currentCounts.rejected}`,
          color: 'yellow',
        });
      }

      const dataToSave = {
        ...data,
        avgCleanTime: data.avgCleanTime / 1000,
      };
      await storageEngine.saveOverviewData(studyId, dataToSave);
      setOverviewData(dataToSave);
    } catch (error) {
      console.error('Failed to save overview data:', error);
      throw error;
    }
  }, [storageEngine, studyId]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  return {
    overviewData,
    loading,
    saveOverviewData,
    refreshOverviewData: loadOverviewData,
  };
}
