import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { OverviewData } from '../../analysis/individualStudy/summary/types';

export function useOverviewData() {
  const { studyId } = useParams();
  const { storageEngine } = useStorageEngine();
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadOverviewData = useCallback(async () => {
    if (!storageEngine || !studyId) return;

    setLoading(true);
    try {
      const data = await storageEngine.getOverviewData();
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
      const dataToSave = {
        ...data,
        avgCleanTime: data.avgCleanTime,
      };
      await storageEngine.saveOverviewData(dataToSave);
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
