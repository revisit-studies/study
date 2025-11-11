import {
  Switch, Text, Title, Flex,
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
        <Title order={4} mb="sm">ReVISit Modes</Title>
        <Text mb="sm">
          ReVISit modes let you control what happens when you visit your study when designing/debugging your study, actively collecting data, and analyzing data when data collection is concluded.
        </Text>

        <Flex gap="xs">
          <Title order={5}>Data Collection</Title>
          <Switch
            size="sm"
            checked={dataCollectionEnabled}
            onChange={(event) => handleSwitch('dataCollectionEnabled', event.currentTarget.checked)}
            mt="3px"
          />
        </Flex>
        <Text mb="sm">
          When enabling data collection, data is written to your data store. Make sure to turn this on when actively collecting data, and turn it off after you have concluded data collection, so you don&apos;t pollute your data by accident.
        </Text>

        <Flex gap="xs">
          <Title order={5}>Development Mode</Title>
          <Switch
            size="sm"
            checked={developmentModeEnabled}
            onChange={(event) => handleSwitch('developmentModeEnabled', event.currentTarget.checked)}
            mt="3px"
          />
        </Flex>
        <Text mb="sm">
          Debug and development mode enables the study navigator, letting visitors jump between tasks. It also disables device checks, such as minimum screen size, and lets you navigate to the analytics interface.
        </Text>

        <Flex gap="xs">
          <Title order={5}>Share Data and Make Analytics Interface Public</Title>
          <Switch
            size="sm"
            checked={dataSharingEnabled}
            onChange={(event) => handleSwitch('dataSharingEnabled', event.currentTarget.checked)}
            mt="3px"
          />
        </Flex>
        <Text>
          When you enabling data sharing, anyone visiting your study website can access the analytics interface and download all of your data. If you disable data sharing, only authenticated users with permissions can access the analytics interface and the associated data.
        </Text>
      </>
    )
  );
}
