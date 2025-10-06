import {
  Stack, Switch, TextInput, Button, Group, Flex, Badge, Text,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';

export function RevisitModesAccordionItem({ studyId }: { studyId: string }) {
  const { storageEngine } = useStorageEngine();

  const [asyncStatus, setAsyncStatus] = useState(false);
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(false);
  const [studyNavigatorEnabled, setStudyNavigatorEnabled] = useState(false);
  const [analyticsInterfacePubliclyAccessible, setAnalyticsInterfacePubliclyAccessible] = useState(false);
  const [stage, setStage] = useState('default');
  const [editingStage, setEditingStage] = useState(false);
  const [tempStage, setTempStage] = useState('default');
  const [stageError, setStageError] = useState('');
  const [allStages, setAllStages] = useState<string[]>(['default']);

  useEffect(() => {
    const fetchData = async () => {
      if (storageEngine) {
        const modes = await storageEngine.getModes(studyId);
        const stageValue = await storageEngine.getStage(studyId);
        const allStagesValue = await storageEngine.getAllStages(studyId);
        setDataCollectionEnabled(modes.dataCollectionEnabled);
        setStudyNavigatorEnabled(modes.studyNavigatorEnabled);
        setAnalyticsInterfacePubliclyAccessible(modes.analyticsInterfacePubliclyAccessible);
        setStage(stageValue);
        setTempStage(stageValue);
        setAllStages(allStagesValue);
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

  const handleStageChange = async (value: string) => {
    if (storageEngine) {
      await storageEngine.setStage(studyId, value);
      setStage(value);
    }
  };

  const handleEditStage = () => {
    setEditingStage(true);
    setTempStage(stage);
    setStageError('');
  };

  const handleSaveStage = async () => {
    // Validate stage name
    if (!tempStage.trim()) {
      setStageError('Stage name cannot be empty');
      return;
    }

    setStageError('');

    if (storageEngine) {
      await storageEngine.setStage(studyId, tempStage.trim());
      setStage(tempStage.trim());
      setEditingStage(false);
    }
  };

  const handleCancelEdit = () => {
    setTempStage(stage);
    setEditingStage(false);
    setStageError('');
  };

  const handleStageLabelClick = (stageName: string) => {
    setTempStage(stageName);
    setStageError('');
  };

  return (
    asyncStatus && (
      <Stack>
        <div>
          <Flex align="end" gap="md">
            <TextInput
              label={<strong>Stage</strong>}
              placeholder="Enter stage name"
              value={editingStage ? tempStage : stage}
              onChange={(event) => (editingStage ? setTempStage(event.currentTarget.value) : handleStageChange(event.currentTarget.value))}
              disabled={!editingStage}
              style={{ flex: 1 }}
              error={stageError}
            />
            <Group>
              {editingStage ? (
                <>
                  <Button size="xs" onClick={handleSaveStage}>
                    Save
                  </Button>
                  <Button size="xs" variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="xs" onClick={handleEditStage}>
                  Edit
                </Button>
              )}
            </Group>
          </Flex>
          {editingStage && allStages.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <Text size="sm" c="dimmed" mb="xs">
                Click to select from existing stages:
              </Text>
              <Group gap="xs">
                {allStages.map((stageName) => (
                  <Badge
                    key={stageName}
                    variant={tempStage === stageName ? 'filled' : 'outline'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleStageLabelClick(stageName)}
                  >
                    {stageName}
                  </Badge>
                ))}
              </Group>
            </div>
          )}
        </div>
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
