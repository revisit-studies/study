import {
  Box, Space, Switch, Text, Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';

export function RevisitModesItem({ studyId }: { studyId: string }) {
  const { storageEngine } = useStorageEngine();

  const [asyncStatus, setAsyncStatus] = useState(false);
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(false);
  const [developmentModeEnabled, setDevelopmentModeEnabled] = useState(false);
  const [dataSharingEnabled, setDataSharingEnabled] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (storageEngine) {
        const modes = await storageEngine.getModes(studyId);
        setDataCollectionEnabled(modes.dataCollectionEnabled);
        setDevelopmentModeEnabled(modes.developmentModeEnabled);
        setDataSharingEnabled(modes.dataSharingEnabled);
        setAsyncStatus(true);
      }
    };
    fetchData();
  }, [storageEngine, studyId]);

  const handleSwitch = async (key: 'dataCollectionEnabled' | 'developmentModeEnabled' | 'dataSharingEnabled', value: boolean) => {
    if (storageEngine) {
      await storageEngine.setMode(studyId, key, value);

      if (key === 'dataCollectionEnabled') {
        setDataCollectionEnabled(value);
      } else if (key === 'developmentModeEnabled') {
        setDevelopmentModeEnabled(value);
      } else if (key === 'dataSharingEnabled') {
        setDataSharingEnabled(value);
      }
    }
  };

  return (
    asyncStatus && (
      <>
        <Text>
          ReVISit modes let you control what happens when you visit your study when designing/debugging your study, actively collecting data, and analyzing data when data collection is concluded.
        </Text>
        <Space h="lg" />
        <Box>
          <Title order={3}>Data Collection</Title>
          <Text>
            When enabling data collection, data is written to your data store. Make sure to turn this on when actively collecting data, and turn it off after you have concluded data collection, so you don&apos;t pollute your data by accident.
          </Text>
          <Switch
            label="Data Collection Enabled"
            checked={dataCollectionEnabled}
            onChange={(event) => handleSwitch('dataCollectionEnabled', event.currentTarget.checked)}
          />
          <Title order={3}>Development Mode</Title>
          <Text>Debug and development mode enables the study navigator, letting visitors jump between tasks. It also disables device checks, such as minimum screen size, and lets you navigate to the analytics interface.</Text>
          <Switch
            label="Development Mode Enabled"
            checked={developmentModeEnabled}
            onChange={(event) => handleSwitch('developmentModeEnabled', event.currentTarget.checked)}
          />
          <Title order={3}>Data Sharing</Title>
          <Text>When you enabling data sharing, anyone visiting your study website can access the analytics interface and download all of your data. If you disable data sharing, only authenticated users with permissions can access the analytics interface and the associated data.</Text>
          <Switch
            label="Share Data and Make Analytics Interface Public"
            checked={dataSharingEnabled}
            onChange={(event) => handleSwitch('dataSharingEnabled', event.currentTarget.checked)}
          />
        </Box>
      </>
    )
  );
}
