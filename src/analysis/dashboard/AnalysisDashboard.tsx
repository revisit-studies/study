import {
  AppShell, Box, Container, Grid, LoadingOverlay, Text, Title,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import { GlobalConfig, ParticipantData, StudyConfig } from '../../parser/types';
import AppHeader from '../interface/AppHeader';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAuth } from '../../store/hooks/useAuth';
import { getStudyConfig } from '../../utils/fetchConfig';
import { StudyCard } from './StudyCard';

export function AnalysisDashboard({ globalConfig }: { globalConfig: GlobalConfig; }) {
  const [loading, setLoading] = useState(false);
  const [expData, setExpData] = useState<Record<string, ParticipantData[]>>({});
  const [studyVisibility, setStudyVisibility] = useState<Record<string, boolean>>({});
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
    (studyVisibility[studyId] || user.isAdmin) && (!globalConfig.configs[studyId].test)
      ? (
        <Grid.Col key={`${studyId}-panel`} span={{ md: 12, xl: 6 }}>
          <StudyCard studyId={studyId} allParticipants={expData[studyId]} />
        </Grid.Col>
      ) : null
  ));

  return (
    <>
      <AppHeader studyIds={globalConfig.configsList} />
      <AppShell.Main>
        <Container fluid>
          <Box>
            <Title mb={20} order={4}>Your Studies:</Title>
            <Grid>
              {gridList.length > 0 ? gridList : <Container mt={100}><Text>No studies to show. If you believe that this is in error, make sure that you are logged in.</Text></Container>}
              <LoadingOverlay visible={loading} />
            </Grid>
          </Box>
        </Container>
      </AppShell.Main>
    </>
  );
}
