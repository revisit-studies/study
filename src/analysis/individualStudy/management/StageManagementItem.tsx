import {
  Stack, TextInput, Button, Group, Table, Text, ColorInput, ColorPicker, Loader, ActionIcon, NumberInput, Paper, Switch, ScrollArea,
  Title, Divider, SegmentedControl, Modal, Popover, Tooltip,
} from '@mantine/core';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import isEqual from 'lodash.isequal';
import {
  IconEdit, IconCheck, IconQuestionMark, IconX,
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
import { ParticipantTimeoutModal } from '../ParticipantTimeoutModal';

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
  participantStatusCounts: { completed: number; inProgress: number };
  desiredParticipants: number | '';
  enabled: boolean;
  [factorName: string]: string | number | boolean | { completed: number; inProgress: number };
};

const DEFAULT_STAGE_COLOR = DISTINCT_COLOR_PALETTE[0];

function getParticipantAssignmentMode(stage: StageInfo): 'even' | 'manual' {
  return stage.participantAssignmentMode
    ?? (stage.desiredParticipantsByCombination ? 'manual' : 'even');
}

function getManualDesiredParticipants(stage: StageInfo) {
  return stage.manualDesiredParticipantsByCombination
    ?? stage.desiredParticipantsByCombination;
}

function getActiveDesiredParticipants(stage: StageInfo) {
  return getParticipantAssignmentMode(stage) === 'manual'
    ? getManualDesiredParticipants(stage)
    : undefined;
}

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

type StageParticipantStatusCounts = Record<string, { completed: number; inProgress: number }>;

export function getStageParticipantStatusCounts(participants: ParticipantDataWithStatus[]) {
  return participants.reduce<StageParticipantStatusCounts>((counts, participant) => {
    if (participant.rejected || participant.timedOut) {
      return counts;
    }

    const stageCounts = counts[participant.stage] || { completed: 0, inProgress: 0 };
    if (participant.completed) {
      stageCounts.completed += 1;
    } else {
      stageCounts.inProgress += 1;
    }
    counts[participant.stage] = stageCounts;
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

function participantMatchesBetweenSubjectsCombination(
  participant: ParticipantDataWithStatus,
  stageName: string,
  combination: BetweenSubjectsCombination,
  betweenSubjectsFactors: BetweenSubjectsFactor[],
) {
  return participant.stage === stageName
    && betweenSubjectsFactors.every((factor) => (
      isEqual(participant.sequence.parameters?.[factor.factorName], combination.parameters[factor.factorName])
    ));
}

function getBetweenSubjectsCombinationStatusCounts(
  participants: ParticipantDataWithStatus[],
  stageName: string,
  combination: BetweenSubjectsCombination,
  betweenSubjectsFactors: BetweenSubjectsFactor[],
) {
  return participants.reduce((counts, participant) => {
    const matchesCombination = !participant.rejected
      && !participant.timedOut
      && participantMatchesBetweenSubjectsCombination(
        participant,
        stageName,
        combination,
        betweenSubjectsFactors,
      );
    if (!matchesCombination) {
      return counts;
    }

    if (participant.completed) {
      counts.completed += 1;
    } else {
      counts.inProgress += 1;
    }
    return counts;
  }, { completed: 0, inProgress: 0 });
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

function renderHeaderWithInformation(label: string, information: string) {
  return (
    <Group gap={4} wrap="nowrap">
      <span>{label}</span>
      <Tooltip label={information}>
        <ActionIcon
          aria-label={`Information about ${label.toLowerCase()} participants`}
          color="gray"
          onClick={(event) => event.stopPropagation()}
          radius="xl"
          size="sm"
          variant="light"
        >
          <IconQuestionMark size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function renderCurrentHeader() {
  return renderHeaderWithInformation(
    'Current',
    'Participants who have started but not yet completed the study',
  );
}

function renderCompletedHeader() {
  return renderHeaderWithInformation(
    'Completed',
    'Completed participants does not include Rejected participants',
  );
}

function renderEnabledHeader() {
  return renderHeaderWithInformation(
    'Enabled',
    'Enable or disable individual combinations of between subject conditions. New participants will only receive one of the active conditions.',
  );
}

function renderDesiredParticipantsCell(
  row: BetweenSubjectsCombinationRow,
  stage: StageInfo,
  disabled: boolean,
  onSetDesiredParticipants: (stage: StageInfo, combinationKey: string, desiredParticipants: number | '') => Promise<void>,
) {
  const totalParticipants = row.participantStatusCounts.completed
    + row.participantStatusCounts.inProgress;

  if (disabled) {
    return <Text size="sm">{`${totalParticipants} / ${row.desiredParticipants ?? '—'}`}</Text>;
  }

  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm">{`${totalParticipants} /`}</Text>
      <NumberInput
        aria-label={`Desired participants for ${row.combinationKey} in ${stage.stageName}`}
        min={0}
        allowDecimal={false}
        hideControls
        value={row.desiredParticipants}
        onChange={(value) => onSetDesiredParticipants(
          stage,
          row.combinationKey,
          typeof value === 'number' ? value : '',
        )}
        w={72}
      />
    </Group>
  );
}

function renderCurrentParticipantsCell(
  row: BetweenSubjectsCombinationRow,
  onReviewInProgress: (combinationKey: string) => void,
) {
  const { inProgress } = row.participantStatusCounts;

  if (inProgress === 0) {
    return <Text size="sm">0</Text>;
  }

  return (
    <Button
      aria-label={`Review ${inProgress} in-progress participant${inProgress === 1 ? '' : 's'}`}
      color="dark"
      onClick={() => onReviewInProgress(row.combinationKey)}
      p={0}
      size="compact-xs"
      variant="transparent"
    >
      {inProgress}
    </Button>
  );
}

function renderCompletedParticipantsCell(row: BetweenSubjectsCombinationRow) {
  return <Text size="sm">{row.participantStatusCounts.completed}</Text>;
}

function BetweenSubjectsCombinationTable({
  stage,
  participants,
  betweenSubjectsFactors,
  combinations,
  onToggle,
  onSetDesiredParticipants,
  onReviewInProgress,
  showParticipantCounts,
  showParticipantLimits,
  desiredParticipantsDisabled = false,
}: {
  stage: StageInfo;
  participants: ParticipantDataWithStatus[];
  betweenSubjectsFactors: BetweenSubjectsFactor[];
  combinations: BetweenSubjectsCombination[];
  onToggle: (stage: StageInfo, combinationKey: string, enabled: boolean) => Promise<void>;
  onSetDesiredParticipants: (stage: StageInfo, combinationKey: string, desiredParticipants: number | '') => Promise<void>;
  onReviewInProgress: (participants: ParticipantDataWithStatus[], description: string) => void;
  showParticipantCounts: boolean;
  showParticipantLimits: boolean;
  desiredParticipantsDisabled?: boolean;
}) {
  const data = useMemo<BetweenSubjectsCombinationRow[]>(() => {
    const desiredParticipantCounts = getDesiredParticipantCounts(
      stage.maxParticipants,
      combinations,
      getActiveDesiredParticipants(stage),
    );

    return combinations.map((combination) => ({
      combinationKey: combination.key,
      participantStatusCounts: getBetweenSubjectsCombinationStatusCounts(
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

  const handleReviewInProgress = useCallback((combinationKey: string) => {
    const combination = combinations.find((item) => item.key === combinationKey);
    if (!combination) {
      return;
    }

    const combinationDescription = betweenSubjectsFactors
      .map((factor) => `${factor.factorName} = ${formatBetweenSubjectsLevel(combination.parameters[factor.factorName])}`)
      .join(', ');
    onReviewInProgress(
      participants.filter((participant) => (
        !participant.completed
        && !participant.rejected
        && !participant.timedOut
        && participantMatchesBetweenSubjectsCombination(
          participant,
          stage.stageName,
          combination,
          betweenSubjectsFactors,
        )
      )),
      `Showing only in-progress participants in the ${stage.stageName} stage with ${combinationDescription} — not all in-progress participants in the study.`,
    );
  }, [betweenSubjectsFactors, combinations, onReviewInProgress, participants, stage.stageName]);

  const columns = useMemo<MrtColumnDef<BetweenSubjectsCombinationRow>[]>(() => [
    ...betweenSubjectsFactors.map((factor) => ({
      accessorKey: factor.factorName,
      header: factor.factorName,
    } satisfies MrtColumnDef<BetweenSubjectsCombinationRow>)),
    ...(showParticipantCounts ? [{
      accessorKey: 'participantStatusCounts',
      header: 'Current',
      Header: renderCurrentHeader,
      Cell: ({ row }: { row: { original: BetweenSubjectsCombinationRow } }) => renderCurrentParticipantsCell(row.original, handleReviewInProgress),
    }, {
      id: 'completedParticipants',
      accessorFn: (row: BetweenSubjectsCombinationRow) => row.participantStatusCounts.completed,
      header: 'Completed',
      Header: renderCompletedHeader,
      Cell: ({ row }: { row: { original: BetweenSubjectsCombinationRow } }) => renderCompletedParticipantsCell(row.original),
    }] : []),
    ...(showParticipantLimits ? [{
      accessorKey: 'desiredParticipants',
      header: 'Total / Maximum',
      size: 240,
      Cell: ({ row }: { row: { original: BetweenSubjectsCombinationRow } }) => renderDesiredParticipantsCell(
        row.original,
        stage,
        desiredParticipantsDisabled,
        onSetDesiredParticipants,
      ),
    }, {
      accessorKey: 'enabled',
      header: 'Enabled',
      Header: renderEnabledHeader,
      Cell: ({ row }: { row: { original: BetweenSubjectsCombinationRow } }) => renderCombinationEnabledCell(
        row.original,
        stage,
        betweenSubjectsFactors,
        onToggle,
      ),
    }] : []),
  ], [
    betweenSubjectsFactors,
    desiredParticipantsDisabled,
    handleReviewInProgress,
    onSetDesiredParticipants,
    onToggle,
    showParticipantCounts,
    showParticipantLimits,
    stage,
  ]);

  const table = useMantineReactTable({
    columns,
    data,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableColumnDragging: true,
    enableColumnOrdering: true,
    enableColumnResizing: true,
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
    mantineTableProps: { style: { minWidth: 'max-content', width: '100%' } },
    mantineTableBodyRowProps: { style: { height: 44 } },
    mantineTableBodyCellProps: ({ column, row }) => {
      const compactCellStyle = { paddingBlock: 4 };
      const factorIndex = betweenSubjectsFactors.findIndex((factor) => factor.factorName === column.id);
      if (factorIndex === -1) {
        return { style: compactCellStyle };
      }

      const factor = betweenSubjectsFactors[factorIndex];
      const levelIndex = factor.levels.findIndex((level) => (
        formatBetweenSubjectsLevel(level) === row.original[factor.factorName]
      ));

      return {
        style: {
          ...compactCellStyle,
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
  const [stageParticipantStatusCounts, setStageParticipantStatusCounts] = useState<StageParticipantStatusCounts>({});
  const [participants, setParticipants] = useState<ParticipantDataWithStatus[]>([]);
  const [timeoutParticipantSelection, setTimeoutParticipantSelection] = useState<{
    participantIds: string[];
    description: string;
  } | null>(null);
  const [pendingStageChange, setPendingStageChange] = useState<StageInfo | null>(null);
  const [pendingConditionToggle, setPendingConditionToggle] = useState<{
    stage: StageInfo;
    combinationKey: string;
    enabled: boolean;
  } | null>(null);
  const [activeStageTooltipName, setActiveStageTooltipName] = useState<string | null>(null);
  const activeStageTooltipTimeoutRef = useRef<number | undefined>(undefined);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStageColor, setEditingStageColor] = useState(DEFAULT_STAGE_COLOR);
  const [editingLimitMaxParticipants, setEditingLimitMaxParticipants] = useState<number | ''>('');
  const [editingLimitEnabled, setEditingLimitEnabled] = useState(false);
  const manualDesiredParticipantsRef = useRef<Record<string, Record<string, number>>>({});
  const manualDesiredParticipantsWriteChainsRef = useRef<Record<string, Promise<void>>>({});
  const [addingNewStage, setAddingNewStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState(DEFAULT_STAGE_COLOR);
  const [newStageError, setNewStageError] = useState('');
  const betweenSubjectsFactors = getBetweenSubjectsFactors(studyConfig);
  const betweenSubjectsCombinations = getBetweenSubjectsCombinations(betweenSubjectsFactors);

  useEffect(() => () => {
    window.clearTimeout(activeStageTooltipTimeoutRef.current);
  }, []);

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
    const selectedStage = stageData.allStages.find((stage) => (
      stage.stageName === stageData.currentStage.stageName
    ));
    setEditingLimitMaxParticipants(selectedStage?.maxParticipants ?? '');
    setEditingLimitEnabled(selectedStage?.maxParticipants !== undefined);
    manualDesiredParticipantsRef.current = Object.fromEntries(stageData.allStages.map((stage) => [
      stage.stageName,
      getManualDesiredParticipants(stage) ?? {},
    ]));
    setParticipants(allParticipants);
    setStageParticipantStatusCounts(getStageParticipantStatusCounts(allParticipants));
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
        setStageParticipantStatusCounts({});
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
      const selectedStage = allStages.find((stage) => stage.stageName === stageName);
      setEditingLimitMaxParticipants(selectedStage?.maxParticipants ?? '');
      setEditingLimitEnabled(selectedStage?.maxParticipants !== undefined);
    }
  };

  const handleRequestSetCurrentStage = (stage: StageInfo) => {
    if (stage.stageName !== currentStage.stageName) {
      setPendingStageChange(stage);
    }
  };

  const handleStageStatusButtonClick = (stage: StageInfo) => {
    if (stage.stageName !== currentStage.stageName) {
      handleRequestSetCurrentStage(stage);
      return;
    }

    setActiveStageTooltipName(stage.stageName);
    window.clearTimeout(activeStageTooltipTimeoutRef.current);
    activeStageTooltipTimeoutRef.current = window.setTimeout(() => {
      setActiveStageTooltipName((stageName) => (
        stageName === stage.stageName ? null : stageName
      ));
    }, 1500);
  };

  const handleConfirmStageChange = async () => {
    if (!pendingStageChange) {
      return;
    }

    await handleSetCurrentStage(pendingStageChange.stageName, pendingStageChange.color);
    setPendingStageChange(null);
  };

  const handleEditStage = (index: number) => {
    setEditingIndex(index);
    setEditingStageColor(allStages[index].color);
  };

  const handleSaveEdit = async (originalName: string) => {
    if (storageEngine) {
      await storageEngine.updateStage(studyId, originalName, {
        color: editingStageColor,
      });

      // Refresh data
      await refreshStageData();
      setEditingIndex(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingStageColor(DEFAULT_STAGE_COLOR);
  };

  const handleSetParticipantLimitEnabled = async (stage: StageInfo, enabled: boolean) => {
    if (!storageEngine) {
      return;
    }

    setEditingLimitEnabled(enabled);
    if (enabled) {
      const manualDesiredParticipants = getManualDesiredParticipants(stage);
      const initialMaximumParticipants = getParticipantAssignmentMode(stage) === 'manual'
        && manualDesiredParticipants
        ? Object.values(manualDesiredParticipants).reduce((total, count) => total + count, 0)
        : Math.max(betweenSubjectsCombinations.length, 1) * 10;
      setEditingLimitMaxParticipants(initialMaximumParticipants);
      await storageEngine.updateStage(studyId, stage.stageName, {
        maxParticipants: initialMaximumParticipants,
      });
      await refreshStageData();
      return;
    }

    setEditingLimitMaxParticipants('');
    await storageEngine.updateStage(studyId, stage.stageName, {
      maxParticipants: null,
    });
    await refreshStageData();
  };

  const handleCommitParticipantLimit = async (stage: StageInfo) => {
    if (!storageEngine || editingLimitMaxParticipants === '') {
      return;
    }

    await storageEngine.updateStage(studyId, stage.stageName, {
      maxParticipants: editingLimitMaxParticipants,
    });
    await refreshStageData();
  };

  const handleAddNewStage = () => {
    setAddingNewStage(true);
    setNewStageName('');
    setNewStageColor(getNextStageColor(allStages));
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
      // Add the new stage by setting it as current (which adds it to allStages).
      await storageEngine.setCurrentStage(studyId, normalizedStageName, newStageColor);

      // Refresh data
      await refreshStageData();
      setAddingNewStage(false);
      setNewStageName('');
      setNewStageColor(DEFAULT_STAGE_COLOR);
    }
  };

  const handleCancelAddNewStage = () => {
    setAddingNewStage(false);
    setNewStageName('');
    setNewStageColor(DEFAULT_STAGE_COLOR);
    setNewStageError('');
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

  const handleRequestConditionToggle = async (
    stage: StageInfo,
    combinationKey: string,
    enabled: boolean,
  ) => {
    setPendingConditionToggle({ stage, combinationKey, enabled });
  };

  const handleConfirmConditionToggle = async () => {
    if (!pendingConditionToggle) {
      return;
    }

    await handleToggleBetweenSubjectsCombination(
      pendingConditionToggle.stage,
      pendingConditionToggle.combinationKey,
      pendingConditionToggle.enabled,
    );
    setPendingConditionToggle(null);
  };

  const handleSetDesiredParticipants = async (
    stage: StageInfo,
    combinationKey: string,
    desiredParticipants: number | '',
  ) => {
    if (!storageEngine) {
      return;
    }

    const currentDesiredParticipantCounts = manualDesiredParticipantsRef.current[stage.stageName]
      ?? getDesiredParticipantCounts(
        stage.maxParticipants,
        betweenSubjectsCombinations,
        getManualDesiredParticipants(stage),
      );
    const nextDesiredParticipantsByCombination = {
      ...currentDesiredParticipantCounts,
      [combinationKey]: desiredParticipants === '' ? 0 : desiredParticipants,
    };
    manualDesiredParticipantsRef.current[stage.stageName] = nextDesiredParticipantsByCombination;

    const previousWrite = manualDesiredParticipantsWriteChainsRef.current[stage.stageName]
      ?? Promise.resolve();
    const write = previousWrite.catch(() => undefined).then(async () => {
      await storageEngine.updateStage(studyId, stage.stageName, {
        manualDesiredParticipantsByCombination: nextDesiredParticipantsByCombination,
        maxParticipants: Object.values(nextDesiredParticipantsByCombination)
          .reduce<number>((total, count) => total + count, 0),
        participantAssignmentMode: 'manual',
      });
      await refreshStageData();
    });
    manualDesiredParticipantsWriteChainsRef.current[stage.stageName] = write;
    await write;
  };

  const handleSetParticipantAssignmentMode = async (stage: StageInfo, mode: string) => {
    if (!storageEngine || stage.maxParticipants === undefined) {
      return;
    }

    await storageEngine.updateStage(studyId, stage.stageName, {
      participantAssignmentMode: mode as 'even' | 'manual',
      ...(mode === 'manual' && !getManualDesiredParticipants(stage)
        ? { manualDesiredParticipantsByCombination: getDefaultDesiredParticipantCounts(stage.maxParticipants, betweenSubjectsCombinations) }
        : {}),
    });
    await refreshStageData();
  };

  const handleReviewInProgress = useCallback((selectedParticipants: ParticipantDataWithStatus[], description: string) => {
    setTimeoutParticipantSelection({
      participantIds: selectedParticipants.map((participant) => participant.participantId),
      description,
    });
  }, []);

  const selectedStage = allStages.find((stage) => stage.stageName === currentStage.stageName)
    ?? allStages[0];
  const participantAssignmentMode = selectedStage
    ? getParticipantAssignmentMode(selectedStage)
    : 'even';
  const selectedStageDesiredParticipantCounts = selectedStage
    ? getDesiredParticipantCounts(
      selectedStage.maxParticipants,
      betweenSubjectsCombinations,
      getActiveDesiredParticipants(selectedStage),
    )
    : {};
  const manuallyAssignedParticipantTotal = Object.values(selectedStageDesiredParticipantCounts)
    .reduce<number>((total, count) => total + (typeof count === 'number' ? count : 0), 0);
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
      <Group align="flex-start" justify="space-between">
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Title order={4}>Stage Management</Title>
          <Text size="sm">
            Stages let you manage the phases of your study. For example, an experiment might have stages for &quot;testing&quot;, &quot;pilots&quot; and &quot;main experiment&quot;.
          </Text>
          <Text size="sm">
            Stage labels are added to the data so you can easily filter them during data analysis. You can control desired numbers of participants in between subject studies for each stage.
          </Text>
        </Stack>
        {!addingNewStage && (
          <Button size="sm" onClick={handleAddNewStage}>
            Add New Stage
          </Button>
        )}
      </Group>

      <ParticipantTimeoutModal
        description={timeoutParticipantSelection?.description}
        hideReviewButton
        onClose={() => setTimeoutParticipantSelection(null)}
        opened={timeoutParticipantSelection !== null}
        participants={timeoutParticipantSelection === null
          ? []
          : participants.filter((participant) => timeoutParticipantSelection.participantIds.includes(participant.participantId))}
        refresh={refreshStageData}
      />

      <Modal
        centered
        onClose={() => setPendingStageChange(null)}
        opened={pendingStageChange !== null}
        title="Activate stage?"
      >
        <Stack gap="md">
          <Text>
            {`New participants will enter ${pendingStageChange?.stageName ?? 'this'} stage. Existing participant records will remain in their current stages.`}
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setPendingStageChange(null)} variant="default">Cancel</Button>
            <Button onClick={handleConfirmStageChange}>Yes, activate stage</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        centered
        onClose={() => setPendingConditionToggle(null)}
        opened={pendingConditionToggle !== null}
        title={pendingConditionToggle?.enabled ? 'Enable condition?' : 'Disable condition?'}
      >
        <Stack gap="md">
          <Text>
            {pendingConditionToggle?.enabled
              ? 'This condition will be available for future participant assignments. Existing participant data will not change.'
              : 'This condition will no longer receive future participant assignments. Existing participant data will not change.'}
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setPendingConditionToggle(null)} variant="default">Cancel</Button>
            <Button onClick={handleConfirmConditionToggle}>
              {pendingConditionToggle?.enabled ? 'Yes, enable condition' : 'Yes, disable condition'}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Table striped highlightOnHover withTableBorder style={{ tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: 90 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 150 }} />
        </colgroup>
        <Table.Thead>
          <Table.Tr>
            <Table.Th aria-label="Stage status" style={{ width: '80px' }} />
            <Table.Th>Stage Name</Table.Th>
            <Table.Th style={{ width: '90px', whiteSpace: 'nowrap' }}>Current</Table.Th>
            <Table.Th style={{ width: '90px', whiteSpace: 'nowrap' }}>Completed</Table.Th>
            <Table.Th style={{ width: '150px', whiteSpace: 'nowrap' }}>Total / Maximum</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {allStages.map((stage, index) => {
            const participantCounts = stageParticipantStatusCounts[stage.stageName] || {
              completed: 0,
              inProgress: 0,
            };
            const totalParticipants = participantCounts.completed + participantCounts.inProgress;

            return (
              <Table.Tr key={stage.stageName}>
                <Table.Td>
                  <Tooltip
                    label="This stage is already active"
                    opened={activeStageTooltipName === stage.stageName}
                    withArrow
                  >
                    <Button
                      aria-label={`${currentStage.stageName === stage.stageName ? 'Active' : 'Inactive'} stage ${stage.stageName}`}
                      color={currentStage.stageName === stage.stageName ? 'green' : 'gray'}
                      onClick={() => handleStageStatusButtonClick(stage)}
                      size="compact-xs"
                      variant={currentStage.stageName === stage.stageName ? 'filled' : 'default'}
                      w={72}
                    >
                      {currentStage.stageName === stage.stageName ? 'Active' : 'Inactive'}
                    </Button>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <div
                      aria-label={`${stage.stageName} color`}
                      style={{
                        width: 14,
                        height: 14,
                        flex: '0 0 auto',
                        backgroundColor: stage.color,
                        border: '1px solid #dee2e6',
                        borderRadius: 3,
                      }}
                    />
                    <Text size="sm">{stage.stageName}</Text>
                    <Popover
                      onChange={(opened) => {
                        if (!opened && editingIndex === index) {
                          handleCancelEdit();
                        }
                      }}
                      opened={editingIndex === index}
                      position="bottom-start"
                      shadow="md"
                    >
                      <Popover.Target>
                        <ActionIcon
                          size="sm"
                          aria-label={`Edit color for stage ${stage.stageName}`}
                          onClick={() => handleEditStage(index)}
                          variant="subtle"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Stack gap="xs">
                          <Text fw={500} size="sm">ReVISit color palette</Text>
                          <ColorPicker
                            aria-label={`Color for stage ${stage.stageName}`}
                            format="hex"
                            onChange={setEditingStageColor}
                            size="md"
                            swatches={DISTINCT_COLOR_PALETTE}
                            swatchesPerRow={10}
                            value={editingStageColor}
                          />
                          <Group justify="flex-end">
                            <Button
                              color="green"
                              onClick={() => handleSaveEdit(stage.stageName)}
                              size="xs"
                            >
                              Save
                            </Button>
                            <Button color="gray" onClick={handleCancelEdit} size="xs" variant="default">
                              Cancel
                            </Button>
                          </Group>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {participantCounts.inProgress > 0 ? (
                    <Button
                      aria-label={`Review ${participantCounts.inProgress} in-progress participant${participantCounts.inProgress === 1 ? '' : 's'}`}
                      color="dark"
                      onClick={() => handleReviewInProgress(participants.filter((participant) => (
                        participant.stage === stage.stageName
                          && !participant.completed
                          && !participant.rejected
                          && !participant.timedOut
                      )), `Showing only in-progress participants in the ${stage.stageName} stage — not all in-progress participants in the study.`)}
                      p={0}
                      size="compact-xs"
                      variant="transparent"
                    >
                      {participantCounts.inProgress}
                    </Button>
                  ) : (
                    <Text size="sm">0</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{participantCounts.completed}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{`${totalParticipants} / ${stage.maxParticipants ?? 'Unlimited'}`}</Text>
                </Table.Td>
              </Table.Tr>
            );
          })}

          {addingNewStage && (
            <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
              <Table.Td />
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <TextInput
                    placeholder="Enter stage name"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.currentTarget.value)}
                    error={newStageError}
                    size="xs"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <ColorInput
                    value={newStageColor}
                    onChange={setNewStageColor}
                    size="xs"
                    w={120}
                  />
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
              <Table.Td>
                <Text size="sm">0</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">0</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">0 / Set after creating</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Divider my="sm" />

      {selectedStage ? (
        <Paper p="sm" radius="sm" withBorder style={{ minWidth: 0 }}>
          <Stack gap="sm">
            <Group align="center" justify="space-between" wrap="nowrap">
              <Group align="center" gap="xs" style={{ minWidth: 0 }} wrap="wrap">
                <Title order={5}>
                  Participant limits for
                  {' '}
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 14,
                        display: 'inline-block',
                        marginRight: 4,
                        verticalAlign: '-2px',
                        backgroundColor: selectedStage.color,
                        border: '1px solid #dee2e6',
                        borderRadius: 3,
                      }}
                    />
                    {selectedStage.stageName}
                  </span>
                </Title>
              </Group>
            </Group>
            <Stack gap="xs">
              <Stack gap={2}>
                <Text fw={500} size="sm">Limit participants</Text>
                <Switch
                  aria-label="Limit participants"
                  checked={editingLimitEnabled}
                  onChange={(event) => handleSetParticipantLimitEnabled(
                    selectedStage,
                    event.currentTarget.checked,
                  )}
                  size="sm"
                />
                <Text c="dimmed" size="xs">
                  Set a maximum number of participants who can enter this stage.
                </Text>
              </Stack>
              <Stack align="flex-start" gap={2}>
                <Text fw={500} size="sm">Assign participants</Text>
                <SegmentedControl
                  aria-label={`Participant assignment mode for ${selectedStage.stageName}`}
                  data={[
                    { label: 'Evenly', value: 'even' },
                    { label: 'Manually', value: 'manual' },
                  ]}
                  disabled={!editingLimitEnabled || selectedStage.maxParticipants === undefined}
                  onChange={(mode) => handleSetParticipantAssignmentMode(selectedStage, mode)}
                  size="sm"
                  value={participantAssignmentMode}
                />
                <Text c="dimmed" size="xs">
                  Choose whether that maximum is divided evenly or set for each condition.
                </Text>
              </Stack>
              <Stack gap={2}>
                <NumberInput
                  aria-label={`Maximum participants for ${selectedStage.stageName}`}
                  disabled={!editingLimitEnabled || (
                    participantAssignmentMode === 'manual'
                    && selectedStage.maxParticipants !== undefined
                  )}
                  label={<Text fw={500} size="sm">Maximum participants</Text>}
                  min={0}
                  allowDecimal={false}
                  hideControls
                  onBlur={() => handleCommitParticipantLimit(selectedStage)}
                  onChange={(value) => setEditingLimitMaxParticipants(typeof value === 'number' ? value : '')}
                  size="sm"
                  value={participantAssignmentMode === 'manual' && selectedStage.maxParticipants !== undefined
                    ? manuallyAssignedParticipantTotal
                    : editingLimitMaxParticipants}
                  w={160}
                />
                <Text c="dimmed" size="xs">
                  {participantAssignmentMode === 'manual'
                    ? 'In manual mode, this total follows the condition maximums below.'
                    : 'Enter the maximum number of participants for this stage.'}
                </Text>
              </Stack>
            </Stack>

            {betweenSubjectsFactors.length === 0 ? (
              <Text size="sm" c="dimmed">This study has no between-subjects factors to allocate.</Text>
            ) : (
              <ScrollArea h={360} type="auto">
                <BetweenSubjectsCombinationTable
                  stage={selectedStage}
                  participants={participants}
                  betweenSubjectsFactors={betweenSubjectsFactors}
                  combinations={betweenSubjectsCombinations}
                  desiredParticipantsDisabled={!editingLimitEnabled || participantAssignmentMode === 'even'}
                  onReviewInProgress={handleReviewInProgress}
                  onSetDesiredParticipants={handleSetDesiredParticipants}
                  onToggle={handleRequestConditionToggle}
                  showParticipantCounts
                  showParticipantLimits
                />
              </ScrollArea>
            )}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
