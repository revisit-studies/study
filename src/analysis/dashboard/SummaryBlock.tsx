import React, { useEffect, useState } from 'react';
import {
  Box, Grid, LoadingOverlay, Title,
} from '@mantine/core';
import { ParticipantData } from '../../storage/types';
import { SummaryPanel } from './SummaryPanel';
import { GlobalConfig, StudyConfig } from '../../parser/types';
import { initializeStorageEngine } from '../../storage/initialize';
import { getStudyConfig } from '../../utils/fetchConfig';

export function SummaryBlock(props: { globalConfig: GlobalConfig; }) {
  const { globalConfig } = props;
  const [loading, setLoading] = useState(false);
  const [expData, setExpData] = useState<Record<string, ParticipantData[]>>({});
  const [expConfig, setExpConfig] = useState<Record<string, StudyConfig>>({});
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allData: Record<string, ParticipantData[]> = {};
      const allConfig: Record<string, StudyConfig> = {};

      const fetchData = async (studyId: string) => {
        const storageEngine = await initializeStorageEngine();
        const config = await getStudyConfig(studyId, globalConfig);
        if (config === null) return;
        await storageEngine.initializeStudyDb(studyId, config as StudyConfig);
        allData[studyId] = await storageEngine.getAllParticipantsData();
        allConfig[studyId] = config;
      };

      const fetchAllData = async () => {
        const promises = globalConfig.configsList.map((studyId) => fetchData(studyId));
        try {
          await Promise.all(promises);
          setExpData(allData);
          setExpConfig(allConfig);
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      };
      await fetchAllData();
    };
    init();
  }, []);

  return (
    <Box>
      <Title mb={20} order={4}>Your Studies:</Title>
      <Grid>
        {globalConfig.configsList.map((studyId) => expData[studyId] && (
          <Grid.Col key={`${studyId}-panel`} md={12} xl={6}>
            <SummaryPanel studyId={studyId} allParticipants={expData[studyId]} config={expConfig[studyId]} />
          </Grid.Col>
        ))}
        <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />
      </Grid>
    </Box>
  );
}
