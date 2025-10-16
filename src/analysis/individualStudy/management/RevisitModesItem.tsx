import {
  Box, Space, Switch, Text, Title, Tooltip, Flex,
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
        <Flex justify="space-between" align="center">
          <Title order={4}>ReVISit Modes</Title>
          <Box style={{ display: 'flex', gap: 10 }}>
            {dataCollectionEnabled
              ? <Tooltip label="Data collection enabled" withinPortal><IconChartBarPopular size={18} color="green" /></Tooltip>
              : <Tooltip label="Data collection disabled" withinPortal><IconChartBarOff size={18} color="red" /></Tooltip>}
            {developmentModeEnabled
              ? <Tooltip label="Development mode enabled" withinPortal><IconSchema size={18} color="green" /></Tooltip>
              : <Tooltip label="Development mode disabled" withinPortal><IconSchemaOff size={18} color="red" /></Tooltip>}
            {dataSharingEnabled
              ? <Tooltip label="Data sharing enabled" withinPortal><IconGraph size={18} color="green" /></Tooltip>
              : <Tooltip label="Data sharing disabled" withinPortal><IconGraphOff size={18} color="red" /></Tooltip>}
          </Box>
        </Flex>

        <Text w="90%">
          ReVISit modes let you control what happens when you visit your study when designing/debugging your study, actively collecting data, and analyzing data when data collection is concluded.
        </Text>

        <Space h="md" />
        <Title order={5}>Data Collection</Title>
        <Text>
          When enabling data collection, data is written to your data store. Make sure to turn this on when actively collecting data, and turn it off after you have concluded data collection, so you don&apos;t pollute your data by accident.
        </Text>
        <Switch
          label={<Text fw={500} size="sm">Data Collection Enabled</Text>}
          labelPosition="left"
          checked={dataCollectionEnabled}
          onChange={(event) => handleSwitch('dataCollectionEnabled', event.currentTarget.checked)}
        />
        <Space h="md" />

        <Title order={5}>Development Mode</Title>

        <Text>
          Debug and development mode enables the study navigator, letting visitors jump between tasks. It also disables device checks, such as minimum screen size, and lets you navigate to the analytics interface.
        </Text>
        <Switch
          label={<Text fw={500} size="sm">Development Mode Enabled</Text>}
          labelPosition="left"
          checked={developmentModeEnabled}
          onChange={(event) => handleSwitch('developmentModeEnabled', event.currentTarget.checked)}
        />
        <Space h="md" />

        <Title order={5}>Data Sharing</Title>
        <Text>
          When you enabling data sharing, anyone visiting your study website can access the analytics interface and download all of your data. If you disable data sharing, only authenticated users with permissions can access the analytics interface and the associated data.
        </Text>
        <Switch
          label={<Text fw={500} size="sm">Share Data and Make Analytics Interface Public</Text>}
          labelPosition="left"
          checked={dataSharingEnabled}
          onChange={(event) => handleSwitch('dataSharingEnabled', event.currentTarget.checked)}
        />
      </>
    )
  );
}
