import {
  Switch, Text, Title, Tooltip, Flex,
} from '@mantine/core';
import {
  IconSchema, IconSchemaOff, IconGraph, IconGraphOff, IconChartBarPopular, IconChartBarOff,
} from '@tabler/icons-react';
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
        <Text size="sm" mb="sm">
          ReVISit modes let you control what happens when you visit your study when designing/debugging your study, actively collecting data, and analyzing data when data collection is concluded.
        </Text>

        <Flex justify="space-between">
          <Title order={5}>Data Collection</Title>
          <Tooltip label={dataCollectionEnabled ? 'Data Collection Enabled' : 'Data Collection Disabled'} refProp="rootRef">
            <Switch
              size="md"
              color="green"
              onLabel={<IconChartBarPopular size={18} />}
              offLabel={<IconChartBarOff size={18} color="red" />}
              checked={dataCollectionEnabled}
              onChange={(event) => handleSwitch('dataCollectionEnabled', event.currentTarget.checked)}
            />
          </Tooltip>
        </Flex>
        <Text size="sm" mb="sm" w="90%">
          When enabling data collection, data is written to your data store. Make sure to turn this on when actively collecting data, and turn it off after you have concluded data collection, so you don&apos;t pollute your data by accident.
        </Text>

        <Flex justify="space-between">
          <Title order={5}>Development Mode</Title>
          <Tooltip label={developmentModeEnabled ? 'Development Mode Enabled' : 'Development Mode Disabled'} refProp="rootRef">
            <Switch
              size="md"
              color="green"
              onLabel={<IconSchema size={18} />}
              offLabel={<IconSchemaOff size={18} color="red" />}
              checked={developmentModeEnabled}
              onChange={(event) => handleSwitch('developmentModeEnabled', event.currentTarget.checked)}
            />
          </Tooltip>
        </Flex>
        <Text size="sm" mb="sm" w="90%">
          Debug and development mode enables the study navigator, letting visitors jump between tasks. It also disables device checks, such as minimum screen size, and lets you navigate to the analytics interface.
        </Text>

        <Flex justify="space-between">
          <Title order={5}>Data Sharing</Title>
          <Tooltip label={dataSharingEnabled ? 'Share Data and Make Analytics Interface Public' : 'Share Data and Make Analytics Interface Private'} refProp="rootRef">
            <Switch
              size="md"
              color="green"
              onLabel={<IconGraph size={18} />}
              offLabel={<IconGraphOff size={18} color="red" />}
              checked={dataSharingEnabled}
              onChange={(event) => handleSwitch('dataSharingEnabled', event.currentTarget.checked)}
            />
          </Tooltip>
        </Flex>
        <Text size="sm" w="90%">
          When you enabling data sharing, anyone visiting your study website can access the analytics interface and download all of your data. If you disable data sharing, only authenticated users with permissions can access the analytics interface and the associated data.
        </Text>
      </>
    )
  );
}
