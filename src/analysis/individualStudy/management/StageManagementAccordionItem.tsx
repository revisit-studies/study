import {
  Stack, TextInput, Button, Group, Flex, Badge, Text,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';

export function StageManagementAccordionItem({ studyId }: { studyId: string }) {
  const { storageEngine } = useStorageEngine();

  const [asyncStatus, setAsyncStatus] = useState(false);
  const [stage, setStage] = useState('default');
  const [editingStage, setEditingStage] = useState(false);
  const [tempStage, setTempStage] = useState('default');
  const [stageError, setStageError] = useState('');
  const [allStages, setAllStages] = useState<string[]>(['default']);

  useEffect(() => {
    const fetchData = async () => {
      if (storageEngine) {
        const stageValue = await storageEngine.getStage(studyId);
        const allStagesValue = await storageEngine.getAllStages(studyId);
        setStage(stageValue);
        setTempStage(stageValue);
        setAllStages(allStagesValue);
        setAsyncStatus(true);
      }
    };
    fetchData();
  }, [storageEngine, studyId]);

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

      // Refresh all stages list
      const updatedStages = await storageEngine.getAllStages(studyId);
      setAllStages(updatedStages);
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
              label={<strong>Current Stage</strong>}
              placeholder="Enter stage name"
              value={editingStage ? tempStage : stage}
              onChange={(event) => setTempStage(event.currentTarget.value)}
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

        <div>
          <Text size="sm" fw={500} mb="xs">All Available Stages</Text>
          <Group gap="xs">
            {allStages.map((stageName) => (
              <Badge
                key={stageName}
                variant={stage === stageName ? 'filled' : 'light'}
                color={stage === stageName ? 'blue' : 'gray'}
              >
                {stageName}
              </Badge>
            ))}
          </Group>
        </div>
      </Stack>
    )
  );
}
