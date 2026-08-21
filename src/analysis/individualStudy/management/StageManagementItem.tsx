import {
  Stack, TextInput, Button, Group, Table, Text, ColorInput, Loader, ActionIcon, Radio, NumberInput, Paper, Switch,
  Title,
} from '@mantine/core';
import {
  Fragment, useCallback, useEffect, useMemo, useState,
} from 'react';
import isEqual from 'lodash.isequal';
import {
  IconEdit, IconCheck, IconX, IconChevronDown, IconChevronUp, IconToggleLeft, IconToggleRight,
} from '@tabler/icons-react';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef as MrtColumnDef,
} from 'mantine-react-table';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { FactorObject, FactorPrimitive, StudyConfig } from '../../../parser/types';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { getBetweenSubjectsCombinationKey, StageInfo } from '../../../storage/engines/types';
import { DISTINCT_COLOR_PALETTE, getDistinctColorShade } from '../../../utils/colors';

type BetweenSubjectsLevel = FactorPrimitive | FactorObject;

type BetweenSubjectsFactor = {
  factorName: string;
  levels: BetweenSubjectsLevel[];
};

type BetweenSubjectsCombination = {
  key: string;
  parameters: Record<string, BetweenSubjectsLevel>;
};

type BetweenSubjectsCombinationRow = {
  combinationKey: string;
  participantCount: number;
  desiredParticipants: number | '';
  enabled: boolean;
  [factorName: string]: string | number | boolean;
};

const DEFAULT_STAGE_COLOR = DISTINCT_COLOR_PALETTE[0];

export function getBetweenSubjectsFactors(studyConfig?: StudyConfig): BetweenSubjectsFactor[] {
  return studyConfig?.betweenSubjects?.flatMap((factorName) => {
    const factor = studyConfig.factors?.[factorName];
    if (!Array.isArray(factor) || factor.length === 0 || !factor.every((level) => (
      typeof level !== 'object' || (level !== null && !Array.isArray(level))
    ))) {
      return [];
    }

    return [{ factorName, levels: factor as BetweenSubjectsLevel[] }];
  }) || [];
}

export function getStageParticipantCounts(participants: ParticipantDataWithStatus[]) {
  return participants.reduce<Record<string, number>>((counts, participant) => {
    if (!participant.rejected) {
      counts[participant.stage] = (counts[participant.stage] || 0) + 1;
    }
    return counts;
  }, {});
}

export function getBetweenSubjectsCombinations(
  betweenSubjectsFactors: BetweenSubjectsFactor[],
): BetweenSubjectsCombination[] {
  if (betweenSubjectsFactors.length === 0) {
    return [];
  }

  const factorNames = betweenSubjectsFactors.map((factor) => factor.factorName);
  return betweenSubjectsFactors.reduce<Record<string, BetweenSubjectsLevel>[]>(
    (combinations, factor) => combinations.flatMap((parameters) => factor.levels.map((level) => ({
      ...parameters,
      [factor.factorName]: level,
    }))),
    [{}],
  ).map((parameters) => ({
    key: getBetweenSubjectsCombinationKey(parameters, factorNames),
    parameters,
  }));
}

export function getBetweenSubjectsCombinationCount(
  participants: ParticipantDataWithStatus[],
  stageName: string,
  combination: BetweenSubjectsCombination,
  betweenSubjectsFactors: BetweenSubjectsFactor[],
) {
  return participants.filter((participant) => (
    !participant.rejected
    && participant.stage === stageName
    && betweenSubjectsFactors.every((factor) => (
      isEqual(participant.sequence.parameters?.[factor.factorName], combination.parameters[factor.factorName])
    ))
  )).length;
}

export function getDefaultDesiredParticipantCounts(
  maxParticipants: number | undefined,
  combinations: BetweenSubjectsCombination[],
) {
  if (maxParticipants === undefined || combinations.length === 0) {
    return {};
  }

  const countPerCombination = Math.floor(maxParticipants / combinations.length);
  const remainder = maxParticipants % combinations.length;

  return Object.fromEntries(combinations.map((combination, index) => [
    combination.key,
    countPerCombination + (index < remainder ? 1 : 0),
  ]));
}

export function getDesiredParticipantCounts(
  maxParticipants: number | undefined,
  combinations: BetweenSubjectsCombination[],
  desiredParticipantsByCombination: Record<string, number> | undefined,
): Record<string, number | ''> {
  const manualCount = combinations.reduce((count, combination) => (
    count + (desiredParticipantsByCombination?.[combination.key] ?? 0)
  ), 0);
  const automaticallyAllocatedCounts = getDefaultDesiredParticipantCounts(
    maxParticipants === undefined ? undefined : Math.max(maxParticipants - manualCount, 0),
    combinations.filter((combination) => !Object.hasOwn(desiredParticipantsByCombination || {}, combination.key)),
  );

  return Object.fromEntries(combinations.map((combination) => [
    combination.key,
    desiredParticipantsByCombination?.[combination.key]
      ?? automaticallyAllocatedCounts[combination.key]
      ?? '',
  ]));
}

function formatBetweenSubjectsLevel(level: BetweenSubjectsLevel) {
  return typeof level === 'object' ? JSON.stringify(level) : String(level);
}

export function validateStageName(stageName: string, allStages: StageInfo[]): string | null {
  const normalizedStageName = stageName.trim();

  if (!normalizedStageName) {
    return 'Stage name cannot be empty';
  }

  const lowerCaseName = normalizedStageName.toLowerCase();

  if (lowerCaseName === 'n/a') {
    return 'Stage name "N/A" is reserved and cannot be used';
  }

  if (lowerCaseName === 'all') {
    return 'Stage name "ALL" is reserved and cannot be used';
  }

  if (lowerCaseName === 'default') {
    return 'Stage name "DEFAULT" is reserved and cannot be used';
  }

  if (allStages.some((stage) => stage.stageName === normalizedStageName)) {
    return 'A stage with this name already exists';
  }

  return null;
}

export function getNextStageColor(allStages: StageInfo[]): string {
  const usedColors = new Set(allStages.map((stage) => stage.color.toLowerCase()));

  return DISTINCT_COLOR_PALETTE.find((color) => !usedColors.has(color.toLowerCase()))
    ?? DISTINCT_COLOR_PALETTE[allStages.length % DISTINCT_COLOR_PALETTE.length];
}

function renderCombinationEnabledCell(
  row: BetweenSubjectsCombinationRow,
  stage: StageInfo,
  betweenSubjectsFactors: BetweenSubjectsFactor[],
  onToggle: (stage: StageInfo, combinationKey: string, enabled: boolean) => Promise<void>,
) {
  const combinationLabel = betweenSubjectsFactors
    .map((factor) => String(row[factor.factorName]))
    .join(' / ');

  return (
    <Switch
      aria-label={`Enable ${combinationLabel} for ${stage.stageName}`}
      checked={row.enabled}
      onChange={(event) => onToggle(
        stage,
        row.combinationKey,
        event.currentTarget.checked,
      )}
    />
  );
}

function renderDesiredParticipantsCell(
  row: BetweenSubjectsCombinationRow,
  stage: StageInfo,
  onSetDesiredParticipants: (stage: StageInfo, combinationKey: string, desiredParticipants: number | '') => Promise<void>,
) {
  return (
    <NumberInput
      aria-label={`Desired participants for ${row.combinationKey} in ${stage.stageName}`}
      min={0}
      allowDecimal={false}
      value={row.desiredParticipants}
      onChange={(value) => onSetDesiredParticipants(
        stage,
        row.combinationKey,
        typeof value === 'number' ? value : '',
      )}
    />
  );
}

function BetweenSubjectsCombinationTable({
  stage,
  participants,
  betweenSubjectsFactors,
  combinations,
  onToggle,
  onSetDesiredParticipants,
}: {
  stage: StageInfo;
  participants: ParticipantDataWithStatus[];
  betweenSubjectsFactors: BetweenSubjectsFactor[];
  combinations: BetweenSubjectsCombination[];
  onToggle: (stage: StageInfo, combinationKey: string, enabled: boolean) => Promise<void>;
  onSetDesiredParticipants: (stage: StageInfo, combinationKey: string, desiredParticipants: number | '') => Promise<void>;
}) {
  const data = useMemo<BetweenSubjectsCombinationRow[]>(() => {
    const desiredParticipantCounts = getDesiredParticipantCounts(
      stage.maxParticipants,
      combinations,
      stage.desiredParticipantsByCombination,
    );

    return combinations.map((combination) => ({
      combinationKey: combination.key,
      participantCount: getBetweenSubjectsCombinationCount(
        participants,
        stage.stageName,
        combination,
        betweenSubjectsFactors,
      ),
      desiredParticipants: desiredParticipantCounts[combination.key],
      enabled: !stage.disabledBetweenSubjectsCombinations?.includes(combination.key),
      ...Object.fromEntries(betweenSubjectsFactors.map((factor) => [
        factor.factorName,
        formatBetweenSubjectsLevel(combination.parameters[factor.factorName]),
      ])),
    }));
  }, [betweenSubjectsFactors, combinations, participants, stage]);

  const columns = useMemo<MrtColumnDef<BetweenSubjectsCombinationRow>[]>(() => [
    ...betweenSubjectsFactors.map((factor) => ({
      accessorKey: factor.factorName,
      header: factor.factorName,
    } satisfies MrtColumnDef<BetweenSubjectsCombinationRow>)),
    {
      accessorKey: 'participantCount',
      header: 'Participants',
    },
    {
      accessorKey: 'desiredParticipants',
      header: 'Desired Participants',
      Cell: ({ row }) => renderDesiredParticipantsCell(
        row.original,
        stage,
        onSetDesiredParticipants,
      ),
    },
    {
      accessorKey: 'enabled',
      header: 'Enabled',
      Cell: ({ row }) => renderCombinationEnabledCell(
        row.original,
        stage,
        betweenSubjectsFactors,
        onToggle,
      ),
    },
  ], [betweenSubjectsFactors, onSetDesiredParticipants, onToggle, stage]);

  const table = useMantineReactTable({
    columns,
    data,
    enableBottomToolbar: false,
    enableColumnDragging: true,
    enableColumnOrdering: true,
    enableDensityToggle: false,
    enablePagination: false,
    enableSorting: true,
    enableTopToolbar: false,
    getRowId: (row) => row.combinationKey,
    mantinePaperProps: {
      style: {
        background: 'transparent', boxShadow: 'none', maxWidth: '100%', minWidth: 0,
      },
    },
    mantineTableContainerProps: { style: { maxWidth: '100%', overflowX: 'auto' } },
    mantineTableProps: { style: { minWidth: 'max-content' } },
    mantineTableBodyCellProps: ({ column, row }) => {
      const factorIndex = betweenSubjectsFactors.findIndex((factor) => factor.factorName === column.id);
      if (factorIndex === -1) {
        return {};
      }

      const factor = betweenSubjectsFactors[factorIndex];
      const levelIndex = factor.levels.findIndex((level) => (
        formatBetweenSubjectsLevel(level) === row.original[factor.factorName]
      ));

      return {
        style: {
          backgroundColor: getDistinctColorShade(factorIndex, levelIndex, factor.levels.length),
        },
      };
    },
  });

  return <MantineReactTable table={table} />;
}

export function StageManagementItem({ studyId, studyConfig }: { studyId: string; studyConfig?: StudyConfig }) {
  const { storageEngine } = useStorageEngine();

  const [asyncStatus, setAsyncStatus] = useState(false);
  const [currentStage, setCurrentStage] = useState<StageInfo>({ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR });
  const [allStages, setAllStages] = useState<StageInfo[]>([{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }]);
  const [stageParticipantCounts, setStageParticipantCounts] = useState<Record<string, number>>({});
  const [participants, setParticipants] = useState<ParticipantDataWithStatus[]>([]);
  const [expandedStageNames, setExpandedStageNames] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [editingStageColor, setEditingStageColor] = useState(DEFAULT_STAGE_COLOR);
  const [editingStageMaxParticipants, setEditingStageMaxParticipants] = useState<number | ''>('');
  const [editingStageLimitEnabled, setEditingStageLimitEnabled] = useState(false);
  const [editError, setEditError] = useState('');
  const [addingNewStage, setAddingNewStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState(DEFAULT_STAGE_COLOR);
  const [newStageMaxParticipants, setNewStageMaxParticipants] = useState<number | ''>('');
  const [newStageLimitEnabled, setNewStageLimitEnabled] = useState(false);
  const [newStageError, setNewStageError] = useState('');
  const betweenSubjectsFactors = getBetweenSubjectsFactors(studyConfig);
  const betweenSubjectsCombinations = getBetweenSubjectsCombinations(betweenSubjectsFactors);

  const refreshStageData = useCallback(async () => {
    if (!storageEngine) {
      return;
    }

    const [stageData, allParticipants] = await Promise.all([
      storageEngine.getStageData(studyId),
      storageEngine.getAllParticipantsData(studyId),
    ]);
    setCurrentStage(stageData.currentStage);
    setAllStages(stageData.allStages);
    setParticipants(allParticipants);
    setStageParticipantCounts(getStageParticipantCounts(allParticipants));
  }, [storageEngine, studyId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshStageData();
      } catch (error) {
        console.error('Failed to load stage data:', error);
        // Set defaults on error
        setCurrentStage({ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR });
        setAllStages([{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }]);
        setStageParticipantCounts({});
        setParticipants([]);
      } finally {
        setAsyncStatus(true);
      }
    };
    fetchData();
  }, [refreshStageData]);

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
    setEditingStageMaxParticipants(allStages[index].maxParticipants ?? '');
    setEditingStageLimitEnabled(allStages[index].maxParticipants !== undefined);
    setEditError('');
  };

  const handleSaveEdit = async (originalName: string) => {
    if (storageEngine) {
      const hasParticipantLimit = editingStageLimitEnabled && editingStageMaxParticipants !== '';
      await storageEngine.updateStage(studyId, originalName, {
        color: editingStageColor,
        maxParticipants: hasParticipantLimit
          ? editingStageMaxParticipants
          : null,
        ...(hasParticipantLimit ? {} : { desiredParticipantsByCombination: null }),
      });

      // Refresh data
      await refreshStageData();
      setEditingIndex(null);
      setEditError('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingStageName('');
    setEditingStageColor(DEFAULT_STAGE_COLOR);
    setEditingStageMaxParticipants('');
    setEditingStageLimitEnabled(false);
    setEditError('');
  };

  const handleAddNewStage = () => {
    setAddingNewStage(true);
    setNewStageName('');
    setNewStageColor(getNextStageColor(allStages));
    setNewStageMaxParticipants('');
    setNewStageLimitEnabled(false);
    setNewStageError('');
  };

  const handleSaveNewStage = async () => {
    const normalizedStageName = newStageName.trim();
    const stageNameError = validateStageName(normalizedStageName, allStages);
    if (stageNameError) {
      setNewStageError(stageNameError);
      return;
    }

    setNewStageError('');

    if (storageEngine) {
      // Add the new stage by setting it as current (which adds it to allStages)
      if (!newStageLimitEnabled || newStageMaxParticipants === '') {
        await storageEngine.setCurrentStage(studyId, normalizedStageName, newStageColor);
      } else {
        await storageEngine.setCurrentStage(studyId, normalizedStageName, newStageColor, newStageMaxParticipants);
      }

      // Refresh data
      await refreshStageData();
      setAddingNewStage(false);
      setNewStageName('');
      setNewStageColor(DEFAULT_STAGE_COLOR);
      setNewStageMaxParticipants('');
      setNewStageLimitEnabled(false);
    }
  };

  const handleCancelAddNewStage = () => {
    setAddingNewStage(false);
    setNewStageName('');
    setNewStageColor(DEFAULT_STAGE_COLOR);
    setNewStageMaxParticipants('');
    setNewStageLimitEnabled(false);
    setNewStageError('');
  };

  const toggleStageExpanded = (stageName: string) => {
    setExpandedStageNames((stageNames) => (
      stageNames.includes(stageName)
        ? stageNames.filter((name) => name !== stageName)
        : [...stageNames, stageName]
    ));
  };

  const handleToggleBetweenSubjectsCombination = async (
    stage: StageInfo,
    combinationKey: string,
    enabled: boolean,
  ) => {
    if (!storageEngine) {
      return;
    }

    const disabledCombinations = stage.disabledBetweenSubjectsCombinations || [];
    const nextDisabledCombinations = enabled
      ? disabledCombinations.filter((key) => key !== combinationKey)
      : [...new Set([...disabledCombinations, combinationKey])];
    await storageEngine.updateStage(studyId, stage.stageName, {
      disabledBetweenSubjectsCombinations: nextDisabledCombinations.length === 0
        ? null
        : nextDisabledCombinations,
    });
    await refreshStageData();
  };

  const handleSetDesiredParticipants = async (
    stage: StageInfo,
    combinationKey: string,
    desiredParticipants: number | '',
  ) => {
    if (!storageEngine) {
      return;
    }

    const nextDesiredParticipantsByCombination = {
      ...stage.desiredParticipantsByCombination,
    };
    const currentDesiredParticipantCounts = getDesiredParticipantCounts(
      stage.maxParticipants,
      betweenSubjectsCombinations,
      stage.desiredParticipantsByCombination,
    );
    betweenSubjectsCombinations.forEach((combination) => {
      if (combination.key === combinationKey) {
        return;
      }

      const currentCount = currentDesiredParticipantCounts[combination.key];
      if (typeof currentCount === 'number') {
        nextDesiredParticipantsByCombination[combination.key] = currentCount;
      }
    });

    if (desiredParticipants === '') {
      delete nextDesiredParticipantsByCombination[combinationKey];
    } else {
      nextDesiredParticipantsByCombination[combinationKey] = desiredParticipants;
    }

    const nextDesiredParticipantCounts = getDesiredParticipantCounts(
      stage.maxParticipants,
      betweenSubjectsCombinations,
      nextDesiredParticipantsByCombination,
    );
    const totalDesiredParticipants = Object.values(nextDesiredParticipantCounts)
      .reduce<number>((total, count) => total + (typeof count === 'number' ? count : 0), 0);
    const hasDesiredParticipantOverrides = Object.keys(nextDesiredParticipantsByCombination).length > 0;

    await storageEngine.updateStage(studyId, stage.stageName, {
      desiredParticipantsByCombination: hasDesiredParticipantOverrides
        ? nextDesiredParticipantsByCombination
        : null,
      maxParticipants: stage.maxParticipants === undefined && !hasDesiredParticipantOverrides
        ? null
        : totalDesiredParticipants,
    });
    await refreshStageData();
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
      <Group>
        <Title order={4} mb="sm">Stage Management</Title>
        {!addingNewStage && (
          <Button size="sm" onClick={handleAddNewStage} ml="auto">
            Add New Stage
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover withTableBorder style={{ tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: 44 }} />
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 80 }} />
        </colgroup>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: '44px' }} />
            <Table.Th style={{ width: '80px', whiteSpace: 'nowrap' }}>Current</Table.Th>
            <Table.Th>Stage Name</Table.Th>
            <Table.Th style={{ width: '100px', whiteSpace: 'nowrap' }}>Participants</Table.Th>
            <Table.Th style={{ width: '150px', whiteSpace: 'nowrap' }}>Max Participants</Table.Th>
            <Table.Th style={{ width: '200px' }}>Color</Table.Th>
            <Table.Th style={{ width: '80px', whiteSpace: 'nowrap' }}>Edit</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {allStages.map((stage, index) => {
            const isExpanded = expandedStageNames.includes(stage.stageName);

            return (
              <Fragment key={stage.stageName}>
                <Table.Tr key={stage.stageName}>
                  <Table.Td>
                    <ActionIcon
                      size="sm"
                      color="gray"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} stage ${stage.stageName}`}
                      onClick={() => toggleStageExpanded(stage.stageName)}
                    >
                      {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                    </ActionIcon>
                  </Table.Td>
                  <Table.Td>
                    <Radio
                      aria-label={`Set current stage to ${stage.stageName}`}
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
                        w="100%"
                      />
                    ) : (
                      <Text size="sm">{stage.stageName}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{stageParticipantCounts[stage.stageName] || 0}</Text>
                  </Table.Td>
                  <Table.Td>
                    {editingIndex === index ? (
                      <Group gap={4} wrap="nowrap">
                        <Button
                          aria-label={`Limit participants for ${stage.stageName}`}
                          size="compact-xs"
                          variant={editingStageLimitEnabled ? 'light' : 'subtle'}
                          color={editingStageLimitEnabled ? 'blue' : 'gray'}
                          onClick={() => {
                            setEditingStageLimitEnabled(!editingStageLimitEnabled);
                            if (editingStageLimitEnabled) {
                              setEditingStageMaxParticipants('');
                            }
                          }}
                        >
                          {editingStageLimitEnabled ? <IconToggleRight size={16} /> : <IconToggleLeft size={16} />}
                        </Button>
                        {editingStageLimitEnabled && (
                          <NumberInput
                            aria-label={`Maximum participants for ${stage.stageName}`}
                            value={editingStageMaxParticipants}
                            onChange={(value) => setEditingStageMaxParticipants(typeof value === 'number' ? value : '')}
                            min={0}
                            allowDecimal={false}
                            size="xs"
                            style={{ flex: 1, minWidth: 0 }}
                          />
                        )}
                      </Group>
                    ) : (
                      <Text size="sm">{stage.maxParticipants ?? 'Unlimited'}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {editingIndex === index ? (
                      <ColorInput
                        value={editingStageColor}
                        onChange={setEditingStageColor}
                        size="xs"
                        w="100%"
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
                          aria-label={`Save stage ${stage.stageName}`}
                          color="green"
                          onClick={() => handleSaveEdit(stage.stageName)}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          aria-label={`Cancel editing stage ${stage.stageName}`}
                          color="gray"
                          onClick={handleCancelEdit}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <ActionIcon
                        size="sm"
                        aria-label={`Edit stage ${stage.stageName}`}
                        onClick={() => handleEditStage(index)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
                {isExpanded && (
                  <Table.Tr key={`${stage.stageName}-conditions`}>
                    <Table.Td colSpan={7} style={{ maxWidth: 0, overflow: 'hidden' }}>
                      <Paper p="sm" radius="sm" withBorder bg="gray.0" style={{ maxWidth: '100%', minWidth: 0 }}>
                        {betweenSubjectsFactors.length === 0 ? (
                          <Text size="sm" c="dimmed">This study has no between-subjects factors.</Text>
                        ) : (
                          <BetweenSubjectsCombinationTable
                            stage={stage}
                            participants={participants}
                            betweenSubjectsFactors={betweenSubjectsFactors}
                            combinations={betweenSubjectsCombinations}
                            onToggle={handleToggleBetweenSubjectsCombination}
                            onSetDesiredParticipants={handleSetDesiredParticipants}
                          />
                        )}
                      </Paper>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            );
          })}

          {addingNewStage && (
            <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
              <Table.Td />
              <Table.Td />
              <Table.Td>
                <TextInput
                  placeholder="Enter stage name"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.currentTarget.value)}
                  error={newStageError}
                  size="xs"
                  w="100%"
                />
              </Table.Td>
              <Table.Td>
                <Text size="sm">0</Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  <Button
                    aria-label="Limit participants for new stage"
                    size="compact-xs"
                    variant={newStageLimitEnabled ? 'light' : 'subtle'}
                    color={newStageLimitEnabled ? 'blue' : 'gray'}
                    onClick={() => {
                      setNewStageLimitEnabled(!newStageLimitEnabled);
                      if (newStageLimitEnabled) {
                        setNewStageMaxParticipants('');
                      }
                    }}
                  >
                    {newStageLimitEnabled ? <IconToggleRight size={16} /> : <IconToggleLeft size={16} />}
                  </Button>
                  {newStageLimitEnabled && (
                    <NumberInput
                      aria-label="Maximum participants for new stage"
                      value={newStageMaxParticipants}
                      onChange={(value) => setNewStageMaxParticipants(typeof value === 'number' ? value : '')}
                      min={0}
                      allowDecimal={false}
                      size="xs"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <ColorInput
                  value={newStageColor}
                  onChange={setNewStageColor}
                  size="xs"
                  w="100%"
                />
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    size="sm"
                    aria-label="Save new stage"
                    color="green"
                    onClick={handleSaveNewStage}
                  >
                    <IconCheck size={16} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    aria-label="Cancel new stage"
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
