import React, { useEffect, useState } from 'react';
import { Box, Grid, Text } from '@mantine/core';
import Loading from '../components/basics/Loading';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { sanitizeStringForUrl } from '../../utils/sanitizeStringForUrl';
import { GlobalConfig } from '../../parser/types';
import { parseStudyConfig } from '../../parser/parser';
import { ParticipantData } from '../../storage/types';

export interface summaryBlockProps {
    databaseSection: string;
    globalConfig: GlobalConfig;
    // studyId: string;
}

export interface expStats {

}

async function fetchStudyConfig(configLocation: string, configKey: string, dataBasePrefix:string) {
  const config = await (await fetch(`${dataBasePrefix}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}
export function SummaryBlock(props: summaryBlockProps) {
  const { globalConfig, databaseSection } = props;
  const [loading, setLoading] = useState(false);
  const [expData, setExpData] = useState<Record<string, ParticipantData[]>>({});

  // const storageEngine = new FirebaseStorageEngine();

  const getConfig = async (studyId:string) => {
    const configKey = globalConfig.configsList.find(
      (c) => sanitizeStringForUrl(c) === studyId,
    );
    if (!configKey) return {};
    const configJSON = globalConfig.configs[configKey];
    return await fetchStudyConfig(`${configJSON.path}`, configKey, databaseSection);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allData:Record<string, ParticipantData[]> = {};

      const fetchData = async (studyId:string) => {
        const storageEngine = new FirebaseStorageEngine();
        const config = await getConfig(studyId);
        if (!config || !storageEngine) return;
        await storageEngine.connect();
        await storageEngine.initializeStudyDb(studyId, config);
        allData[studyId] = await storageEngine.getAllParticipantsData();
        // setExpData({
        //     ...expData,
        //     [studyId]: allData
        // })
      };

      const fetchAllData = async () => {
        const studyIds = globalConfig.configsList;
        // const studyIds = ['html-demo'];
        const promises = studyIds.map((studyId) => fetchData(studyId));
        try {
          // Use Promise.all to wait for all promises to resolve
          await Promise.all(promises);
          // console.log('All data fetched successfully');
          setExpData(allData);
          setLoading(false);
        } catch (error) {
          // console.error('Error fetching data:', error);
          setLoading(false);
        }
      };

      fetchAllData();
      // if (!storageEngine || !configKey || !studyId) return;
    };

    init();
  }, []);

  useEffect(() => {
    // console.log(expData, 'expdata');
  }, [expData]);

  return (
    <Box>
      <Text mt={20} mb={20} fw={700}>Total Record: </Text>
      <Grid>
        {/* {studyIDs.split(',').map((studyID:string) => */}
        {/*    <Grid.Col md={12} xl={6}> */}
        {/*    /!*<SummaryPanel databaseSection={props.databaseSection} studyId={studyID} data={filterData(studyID) as fireBaseData[]} />*!/ */}
        {/* </Grid.Col>)} */}

        <Loading isLoading={loading} />
      </Grid>
    </Box>
  );
}
