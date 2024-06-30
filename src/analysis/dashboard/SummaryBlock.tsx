import React, { useEffect, useState } from 'react';
import {
  Box, Grid, LoadingOverlay, Title, Container, Text,
} from '@mantine/core';
import { ParticipantData } from '../../storage/types';
import { SummaryPanel } from './SummaryPanel';
import { GlobalConfig, StudyConfig } from '../../parser/types';
import { getStudyConfig } from '../../utils/fetchConfig';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { useAuth } from '../../store/hooks/useAuth';

export function SummaryBlock(props: { globalConfig: GlobalConfig; }) {
  const { globalConfig } = props;
  const [loading, setLoading] = useState(false);
  const [expData, setExpData] = useState<Record<string, ParticipantData[]>>({});
  const [expConfig, setExpConfig] = useState<Record<string, StudyConfig>>({});
  const [expStudyVisibility, setStudyVisibility] = useState<Record<string, boolean>>({});
  const { storageEngine } = useStorageEngine();

  const { user } = useAuth();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allData: Record<string, ParticipantData[]> = {};
      const allConfig: Record<string, StudyConfig> = {};
      const allStudyVisibility: Record<string, boolean> = {};

      const fetchData = async (studyId: string) => {
        const config = await getStudyConfig(studyId, globalConfig);
        if (storageEngine) {
          allData[studyId] = await storageEngine.getAllParticipantsDataByStudy(studyId);
          if (config === null) return;
          allConfig[studyId] = config;
          if (storageEngine instanceof FirebaseStorageEngine) {
            const modes = await storageEngine.getModes(studyId);
            allStudyVisibility[studyId] = modes.analyticsInterfacePubliclyAccessible;
          }
        }
      };

      const fetchAllData = async () => {
        const promises = globalConfig.configsList.map((studyId) => fetchData(studyId));
        try {
          await Promise.all(promises);
          setExpData(allData);
          setExpConfig(allConfig);
          setStudyVisibility(allStudyVisibility);
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      };
      await fetchAllData();
    };
    init();
  }, [globalConfig, storageEngine]);

  const gridList = globalConfig.configsList.map((studyId) => expData[studyId] && (
    (expStudyVisibility[studyId] || user.isAdmin)
      ? (
        <Grid.Col key={`${studyId}-panel`} span={{ md: 12, xl: 6 }}>
          <SummaryPanel studyId={studyId} allParticipants={expData[studyId]} config={expConfig[studyId]} />
        </Grid.Col>
      ) : null
  ));

  return (
    <Box>
      <Title mb={20} order={4}>Your Studies:</Title>
      <Grid>
        {gridList.length > 0 ? gridList : <Container mt={100}><Text>No studies to show. If you believe that this is in error, make sure that you are logged in.</Text></Container>}
        <LoadingOverlay visible={loading} />
      </Grid>
    </Box>
  );
}
