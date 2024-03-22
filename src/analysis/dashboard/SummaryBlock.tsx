import React, { useEffect, useState } from 'react';
import { Box, Grid, Text } from '@mantine/core';
import Loading from '../components/basics/Loading';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { sanitizeStringForUrl } from '../../utils/sanitizeStringForUrl';
import { GlobalConfig } from '../../parser/types';
import { parseStudyConfig } from '../../parser/parser';

type summaryBlockProps = {
    databaseSection: string;
    globalConfig: GlobalConfig;
    studyId: string;
}

async function fetchStudyConfig(configLocation: string, configKey: string, dataBasePrefix:string) {
  const config = await (await fetch(`${dataBasePrefix}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}
export function SummaryBlock(props: summaryBlockProps) {
  const { globalConfig, databaseSection, studyId } = props;
  const [loading, setLoading] = useState(false);
  const storageEngine = new FirebaseStorageEngine();
  const configKey = globalConfig.configsList.find(
    (c) => sanitizeStringForUrl(c) === studyId,
  );

  useEffect(() => {
    const init = async () => {
      if (!storageEngine || !configKey || !studyId) return;

      setLoading(true);
      const configJSON = globalConfig.configs[configKey];
      const config = await fetchStudyConfig(`${configJSON.path}`, configKey, databaseSection);
      await storageEngine.connect();
      await storageEngine.initializeStudyDb(studyId, config);
      const allData = await storageEngine.getAllParticipantsData();
      // setAllData(allData);
      // console.log(allData, 'alldata');
      setLoading(false);
    };

    init();
  }, []);

  // useEffect(() => {
  //     const getAllData = async () => {
  //         setLoading(true)
  //         if(storageEngine){
  //             const allParticipantData = await storageEngine.getAllParticipantsData();
  //             setAllData(allParticipantData);
  //             console.log(allParticipantData)
  //         }
  //         setLoading(false)
  //     }
  //     console.log(initialized,"initialized")
  //
  //     if(initialized){
  //         getAllData();
  //     }
  //
  //
  // }, [initialized]);

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
