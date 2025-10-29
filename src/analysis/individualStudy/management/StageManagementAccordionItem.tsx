import {
  Stack, TextInput, Button, Group, Table, Text, ColorInput, Loader, ActionIcon, Radio,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  IconEdit, IconCheck, IconX,
} from '@tabler/icons-react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { StageInfo } from '../../../storage/engines/types';

export function StageManagementAccordionItem({ studyId }: { studyId: string }) {
  const { storageEngine } = useStorageEngine();

  const [asyncStatus, setAsyncStatus] = useState(false);
  const [currentStage, setCurrentStage] = useState<StageInfo>({ stageName: 'DEFAULT', color: '#F05A30' });
  const [allStages, setAllStages] = useState<StageInfo[]>([{ stageName: 'DEFAULT', color: '#F05A30' }]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [editingStageColor, setEditingStageColor] = useState('#F05A30');
  const [editError, setEditError] = useState('');
  const [addingNewStage, setAddingNewStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#F05A30');
  const [newStageError, setNewStageError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (storageEngine) {
        try {
          const stageData = await storageEngine.getStageData(studyId);
          setCurrentStage(stageData.currentStage);
          setAllStages(stageData.allStages);
          setAsyncStatus(true);
        } catch (error) {
          console.error('Failed to load stage data:', error);
          // Set defaults on error
          setCurrentStage({ stageName: 'DEFAULT', color: '#F05A30' });
          setAllStages([{ stageName: 'DEFAULT', color: '#F05A30' }]);
          setAsyncStatus(true);
        }
      }
    };
    fetchData();
  }, [storageEngine, studyId]);

  const handleSetCurrentStage = async (stageName: string, color: string) => {
    if (storageEngine) {
      await storageEngine.setCurrentStage(studyId, stageName, color);
      setCurrentStage({ stageName, color });
    }
  };

  const handleEditStage = (index: number) => {
    setEditingIndex(index);
    setEditingStageName(allStages[index].stageName);
    setEditingStageColor(allStages[index].color);
    setEditError('');
  };

  const handleSaveEdit = async (originalName: string) => {
    if (storageEngine) {
      // Update the stage color
      await storageEngine.updateStageColor(studyId, originalName, editingStageColor);

      // Refresh data
      const stageData = await storageEngine.getStageData(studyId);
      setCurrentStage(stageData.currentStage);
      setAllStages(stageData.allStages);
      setEditingIndex(null);
      setEditError('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingStageName('');
    setEditingStageColor('#F05A30');
    setEditError('');
  };

  const handleAddNewStage = () => {
    setAddingNewStage(true);
    setNewStageName('');
    setNewStageColor('#F05A30');
    setNewStageError('');
  };

  const handleSaveNewStage = async () => {
    if (!newStageName.trim()) {
      setNewStageError('Stage name cannot be empty');
      return;
    }

    const normalizedStageName = newStageName.trim();
    const lowerCaseName = normalizedStageName.toLowerCase();

    if (lowerCaseName === 'n/a') {
      setNewStageError('Stage name "N/A" is reserved and cannot be used');
      return;
    }

    if (lowerCaseName === 'all') {
      setNewStageError('Stage name "ALL" is reserved and cannot be used');
      return;
    }

    if (lowerCaseName === 'default') {
      setNewStageError('Stage name "DEFAULT" is reserved and cannot be used');
      return;
    }

    if (allStages.some((s) => s.stageName === normalizedStageName)) {
      setNewStageError('A stage with this name already exists');
      return;
    }

    setNewStageError('');

    if (storageEngine) {
      // Add the new stage by setting it as current (which adds it to allStages)
      await storageEngine.setCurrentStage(studyId, normalizedStageName, newStageColor);

      // Refresh data
      const stageData = await storageEngine.getStageData(studyId);
      setCurrentStage(stageData.currentStage);
      setAllStages(stageData.allStages);
      setAddingNewStage(false);
      setNewStageName('');
      setNewStageColor('#F05A30');
    }
  };

  const handleCancelAddNewStage = () => {
    setAddingNewStage(false);
    setNewStageName('');
    setNewStageColor('#F05A30');
    setNewStageError('');
  };

  if (!asyncStatus) {
    return (
      <Stack align="center" p="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading stage data...</Text>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" mb="md">
        {!addingNewStage && (
          <Button size="sm" onClick={handleAddNewStage}>
            Add New Stage
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: '80px', whiteSpace: 'nowrap' }}>Current</Table.Th>
            <Table.Th>Stage Name</Table.Th>
            <Table.Th style={{ width: '200px' }}>Color</Table.Th>
            <Table.Th style={{ width: '80px', whiteSpace: 'nowrap' }}>Edit</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {allStages.map((stage, index) => (
            <Table.Tr key={stage.stageName}>
              <Table.Td>
                <Radio
                  checked={currentStage.stageName === stage.stageName}
                  onChange={() => handleSetCurrentStage(stage.stageName, stage.color)}
                />
              </Table.Td>
              <Table.Td>
                {editingIndex === index ? (
                  <TextInput
                    value={editingStageName}
                    onChange={(e) => setEditingStageName(e.currentTarget.value)}
                    error={editError}
                    size="xs"
                    disabled
                  />
                ) : (
                  <Text size="sm">{stage.stageName}</Text>
                )}
              </Table.Td>
              <Table.Td>
                {editingIndex === index ? (
                  <ColorInput
                    value={editingStageColor}
                    onChange={setEditingStageColor}
                    size="xs"
                  />
                ) : (
                  <Group gap="xs">
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: stage.color,
                        border: '1px solid #dee2e6',
                        borderRadius: 4,
                      }}
                    />
                    <Text size="sm" c="dimmed">{stage.color}</Text>
                  </Group>
                )}
              </Table.Td>
              <Table.Td>
                {editingIndex === index ? (
                  <Group gap="xs">
                    <ActionIcon
                      size="sm"
                      color="green"
                      onClick={() => handleSaveEdit(stage.stageName)}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      color="gray"
                      onClick={handleCancelEdit}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <ActionIcon
                    size="sm"
                    onClick={() => handleEditStage(index)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                )}
              </Table.Td>
            </Table.Tr>
          ))}

          {addingNewStage && (
            <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
              <Table.Td />
              <Table.Td>
                <TextInput
                  placeholder="Enter stage name"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.currentTarget.value)}
                  error={newStageError}
                  size="xs"
                />
              </Table.Td>
              <Table.Td>
                <ColorInput
                  value={newStageColor}
                  onChange={setNewStageColor}
                  size="xs"
                />
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    size="sm"
                    color="green"
                    onClick={handleSaveNewStage}
                  >
                    <IconCheck size={16} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    color="gray"
                    onClick={handleCancelAddNewStage}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {editError && (
        <Text size="sm" c="red" mt="xs">
          Note: Stage names cannot be changed, only colors can be edited.
        </Text>
      )}
    </Stack>
  );
}
