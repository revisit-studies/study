import React, { useEffect, useState } from 'react';
import {
  Box, Grid, LoadingOverlay, Text,
} from '@mantine/core';
import { ParticipantData } from '../../storage/types';
import SummaryPanel from './SummaryPanel';
import { getConfig } from '../utils';
import { GlobalConfig, StudyConfig } from '../../parser/types';
import { useStorageEngine } from '../../store/storageEngineHooks';

export function SummaryBlock(props: { globalConfig: GlobalConfig; }) {
  const { globalConfig } = props;
  const [loading, setLoading] = useState(false);
  const [expData, setExpData] = useState<Record<string, ParticipantData[]>>({});
  const studyIds = globalConfig.configsList;
  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allData:Record<string, ParticipantData[]> = {};

      const fetchData = async (studyId:string) => {
        const config = await getConfig(studyId, globalConfig);
        if (!config || !storageEngine) return;
        if (!storageEngine.isConnected()) await storageEngine.connect();
        await storageEngine.initializeStudyDb(studyId, config as StudyConfig);
        allData[studyId] = await storageEngine.getAllParticipantsData();
      };

      const fetchAllData = async () => {
        // const studyIds = ['html-demo'];
        const promises = studyIds.map((studyId) => fetchData(studyId));
        try {
          await Promise.all(promises);
          setExpData(allData);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching data:', error);
          setLoading(false);
        }
      };
      await fetchAllData();
    };
    init();
  }, []);

  return (
    <Box>
      <Text mt={20} mb={20} fw={700}>Total Record: </Text>
      <Grid>
        {studyIds.map((studyID:string) => (
          <Grid.Col key={`${studyID}-panel`} md={12} xl={6}>
            <SummaryPanel studyId={studyID} data={expData[studyID]} />
          </Grid.Col>
        ))}
        <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />
      </Grid>
    </Box>
  );
}
