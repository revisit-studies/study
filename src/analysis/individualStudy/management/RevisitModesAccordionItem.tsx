import { Stack, Switch } from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';

export function RevisitModesAccordionItem({ studyId }: { studyId: string }) {
  const { storageEngine } = useStorageEngine();

  const [asyncStatus, setAsyncStatus] = useState(false);
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(false);
  const [studyNavigatorEnabled, setStudyNavigatorEnabled] = useState(false);
  const [analyticsInterfacePubliclyAccessible, setAnalyticsInterfacePubliclyAccessible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (storageEngine) {
        const modes = await storageEngine.getModes(studyId);
        setDataCollectionEnabled(modes.dataCollectionEnabled);
        setStudyNavigatorEnabled(modes.studyNavigatorEnabled);
        setAnalyticsInterfacePubliclyAccessible(modes.analyticsInterfacePubliclyAccessible);
        setAsyncStatus(true);
      }
    };
    fetchData();
  }, [storageEngine, studyId]);

  const handleSwitch = async (key: 'dataCollectionEnabled' | 'studyNavigatorEnabled' | 'analyticsInterfacePubliclyAccessible', value: boolean) => {
    if (storageEngine) {
      await storageEngine.setMode(studyId, key, value);

      if (key === 'dataCollectionEnabled') {
        setDataCollectionEnabled(value);
      } else if (key === 'studyNavigatorEnabled') {
        setStudyNavigatorEnabled(value);
      } else if (key === 'analyticsInterfacePubliclyAccessible') {
        setAnalyticsInterfacePubliclyAccessible(value);
      }
    }
  };

  return (
    asyncStatus && (
      <Stack>
        <Switch
          label="Data Collection Enabled"
          checked={dataCollectionEnabled}
          onChange={(event) => handleSwitch('dataCollectionEnabled', event.currentTarget.checked)}
        />
        <Switch
          label="Study Navigator Enabled"
          checked={studyNavigatorEnabled}
          onChange={(event) => handleSwitch('studyNavigatorEnabled', event.currentTarget.checked)}
        />
        <Switch
          label="Analytics Interface Publicly Accessible"
          checked={analyticsInterfacePubliclyAccessible}
          onChange={(event) => handleSwitch('analyticsInterfacePubliclyAccessible', event.currentTarget.checked)}
        />
      </Stack>
    )
  );
}
