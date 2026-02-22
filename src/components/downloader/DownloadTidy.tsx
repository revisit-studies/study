import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Flex,
  Group,
  LoadingOverlay,
  Modal,
  Progress,
  Space,
  Table,
  Text,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBrandPython, IconLayoutColumns, IconTableExport, IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { ParticipantData } from '../../storage/types';
import { Prettify, StudyConfig } from '../../parser/types';
import { StorageEngine } from '../../storage/engines/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { useAsync } from '../../store/hooks/useAsync';
import { getCleanedDuration } from '../../utils/getCleanedDuration';
import { showNotification } from '../../utils/notifications';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { parseConditionParam } from '../../utils/handleConditionLogic';

const OPTIONAL_COMMON_PROPS = [
  'condition',
  'stage',
  'status',
  'rejectReason',
  'rejectTime',
  'percentComplete',
  'description',
  'instruction',
  'responsePrompt',
  'answer',
  'correctAnswer',
  'duration',
  'cleanedDuration',
  'meta',
  'transcript',
  'startTime',
  'endTime',
  'responseMin',
  'responseMax',
  'configHash',
] as const;

const REQUIRED_PROPS = [
  'participantId',
  'trialId',
  'trialOrder',
  'responseId',
] as const;

type OptionalProperty = (typeof OPTIONAL_COMMON_PROPS)[number];
type RequiredProperty = (typeof REQUIRED_PROPS)[number];
type MetaProperty = `meta-${string}`;

type Property = OptionalProperty | RequiredProperty | MetaProperty;
// Cap in-flight transcript requests to avoid flooding browser/network/Firebase on large studies.
const TRANSCRIPTION_CONCURRENCY_LIMIT = 50;

async function runWithConcurrencyLimit(tasks: Array<() => Promise<void>>, concurrencyLimit: number) {
  const safeLimit = Math.max(1, concurrencyLimit);
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    const currentIndex = nextIndex;
    nextIndex += 1;

    if (currentIndex >= tasks.length) {
      return;
    }

    await tasks[currentIndex]();
    await runNext();
  };

  const workers = Array.from({ length: Math.min(safeLimit, tasks.length) }, () => runNext());
  await Promise.all(workers);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TidyRow = Prettify<Record<RequiredProperty, any> & Partial<Record<OptionalProperty | MetaProperty, any>>> & Record<string, number | string[] | boolean | string | null>;

export function download(graph: string, filename: string) {
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(graph)}`;
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', filename);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function participantDataToRows(participant: ParticipantData, properties: Property[], studyConfig: StudyConfig, transcripts?: Record<string, string | null>): [TidyRow[], string[]] {
  const percentComplete = ((Object.entries(participant.answers).filter(([_, entry]) => entry.endTime !== -1).length / (Object.entries(participant.answers).length)) * 100).toFixed(2);
  const newHeaders = new Set<string>();
  const participantConditions = parseConditionParam(participant.conditions ?? participant.searchParams?.condition);
  const conditionValue = participantConditions.length > 0 ? participantConditions.join(',') : 'default';

  return [[
    {
      participantId: participant.participantId,
      trialId: 'participantTags',
      trialOrder: null,
      responseId: 'participantTags',
      answer: JSON.stringify(participant.participantTags),
      ...(properties.includes('condition') ? { condition: conditionValue } : {}),
      ...(properties.includes('stage') ? { stage: participant.stage } : {}),
    },
    ...Object.values(participant.answers).map((trialAnswer) => {
      // Get the whole component, including the base component if there is inheritance
      const trialId = trialAnswer.componentName;
      const { trialOrder } = trialAnswer;
      const trialConfig = studyConfig.components[trialId];
      const completeComponent = studyComponentToIndividualComponent(trialConfig, studyConfig);

      const duration = trialAnswer.endTime === -1 ? undefined : trialAnswer.endTime - trialAnswer.startTime;
      const cleanedDuration = getCleanedDuration(trialAnswer);

      const answersToLoopOver = Object.keys(trialAnswer.answer).length === 0 ? { '': undefined } : trialAnswer.answer;
      const rows = Object.entries(answersToLoopOver).map(([key, value]) => {
        const tidyRow: TidyRow = {
          participantId: participant.participantId,
          trialId,
          trialOrder,
          responseId: key,
        };

        Object.entries(trialAnswer.parameters).forEach(([_key, _value]) => {
          tidyRow[`parameters_${_key}`] = _value;
          newHeaders.add(`parameters_${_key}`);
        });

        const response = completeComponent.response.find((resp) => resp.id === key);
        if (properties.includes('condition')) {
          tidyRow.condition = conditionValue;
        }
        if (properties.includes('stage')) {
          tidyRow.stage = participant.stage;
        }
        if (properties.includes('status')) {
          tidyRow.status = participant.rejected ? 'rejected' : (participant.completed ? 'completed' : 'in progress');
        }
        if (properties.includes('rejectReason')) {
          tidyRow.rejectReason = participant.rejected ? participant.rejected.reason : undefined;
        }
        if (properties.includes('rejectTime')) {
          tidyRow.rejectTime = participant.rejected ? new Date(participant.rejected.timestamp).toISOString() : undefined;
        }
        if (properties.includes('configHash')) {
          tidyRow.configHash = participant.participantConfigHash;
        }
        if (properties.includes('percentComplete')) {
          tidyRow.percentComplete = percentComplete;
        }
        if (properties.includes('description')) {
          tidyRow.description = completeComponent.description;
        }
        if (properties.includes('instruction')) {
          tidyRow.instruction = completeComponent.instruction;
        }
        if (properties.includes('responsePrompt')) {
          tidyRow.responsePrompt = response?.prompt;
        }
        if (properties.includes('answer')) {
          tidyRow.answer = typeof value === 'object' ? JSON.stringify(value) : value;
        }
        if (properties.includes('transcript')) {
          const identifier = trialAnswer.identifier || `${trialId}_${trialOrder}`;
          tidyRow.transcript = transcripts?.[`${participant.participantId}_${identifier}`] ?? undefined;
        }
        if (properties.includes('correctAnswer')) {
          const configCorrectAnswer = completeComponent.correctAnswer?.find((ans) => ans.id === key)?.answer;
          const answerCorrectAnswer = trialAnswer.correctAnswer.find((ans) => ans.id === key)?.answer;
          const correctAnswer = answerCorrectAnswer || configCorrectAnswer;
          tidyRow.correctAnswer = typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : correctAnswer;
        }
        if (properties.includes('startTime')) {
          tidyRow.startTime = new Date(trialAnswer.startTime).toISOString();
        }
        if (properties.includes('endTime')) {
          tidyRow.endTime = new Date(trialAnswer.endTime).toISOString();
        }
        if (properties.includes('duration')) {
          tidyRow.duration = duration;
        }
        if (properties.includes('cleanedDuration')) {
          tidyRow.cleanedDuration = cleanedDuration;
        }
        if (properties.includes('meta')) {
          tidyRow.meta = JSON.stringify(completeComponent.meta, null, 2);
        }
        if (properties.includes('responseMin')) {
          tidyRow.responseMin = response?.type === 'numerical' ? response.min : undefined;
        }
        if (properties.includes('responseMax')) {
          tidyRow.responseMax = response?.type === 'numerical' ? response.max : undefined;
        }
        return tidyRow;
      }).flat();

      const windowEventsCount = {
        focus: trialAnswer.windowEvents.filter((event) => event[1] === 'focus').length,
        input: trialAnswer.windowEvents.filter((event) => event[1] === 'input').length,
        keydown: trialAnswer.windowEvents.filter((event) => event[1] === 'keydown').length,
        keyup: trialAnswer.windowEvents.filter((event) => event[1] === 'keyup').length,
        mousemove: trialAnswer.windowEvents.filter((event) => event[1] === 'mousemove').length,
        mousedown: trialAnswer.windowEvents.filter((event) => event[1] === 'mousedown').length,
        mouseup: trialAnswer.windowEvents.filter((event) => event[1] === 'mouseup').length,
        resize: trialAnswer.windowEvents.filter((event) => event[1] === 'resize').length,
        scroll: trialAnswer.windowEvents.filter((event) => event[1] === 'scroll').length,
        visibility: trialAnswer.windowEvents.filter((event) => event[1] === 'visibility').length,
      };

      // Add a window events count row for each component
      rows.push({
        participantId: participant.participantId,
        trialId,
        trialOrder,
        responseId: 'windowEvents',
        answer: JSON.stringify(windowEventsCount),
        ...(properties.includes('condition') ? { condition: conditionValue } : {}),
        ...(properties.includes('stage') ? { stage: participant.stage } : {}),
      } as TidyRow);

      return rows;
    }).flat()], Array.from(newHeaders)];
}

async function getTableData(
  selectedProperties: Property[],
  data: ParticipantData[],
  storageEngine: StorageEngine | undefined,
  studyId: string,
  hasAudio?: boolean,
) {
  if (!storageEngine) {
    return { header: [], rows: [] };
  }

  const combinedProperties = [...REQUIRED_PROPS, ...selectedProperties];

  const allConfigHashes = [...new Set(data.map((part) => part.participantConfigHash))];
  const allConfigs = await storageEngine.getAllConfigsFromHash(allConfigHashes, studyId);

  const transcripts: Record<string, string | null> = {};
  const transcriptAvailable = storageEngine.getEngine() === 'firebase' && !!hasAudio;
  if (selectedProperties.includes('transcript') && transcriptAvailable) {
    const allAnswers = data.flatMap((p) => Object.values(p.answers)
      // Only fetch transcripts for trials that were actually started or completed.
      .filter((answer) => ((answer?.endTime ?? -1) > 0) || ((answer?.startTime ?? -1) > 0))
      .map((answer) => ({ answer, participantId: p.participantId })));
    const tasks = allAnswers.map(({ answer, participantId }) => async () => {
      const identifier = answer.identifier || `${answer.componentName}_${answer.trialOrder}`;
      const key = `${participantId}_${identifier}`;

      try {
        const t = await (storageEngine as FirebaseStorageEngine).getTranscription(identifier, participantId);
        const text = t?.results?.map((r) => r.alternatives?.[0]?.transcript).join(' ');
        transcripts[key] = text || null;
      } catch {
        transcripts[key] = null;
      }
    });
    await runWithConcurrencyLimit(tasks, TRANSCRIPTION_CONCURRENCY_LIMIT);
  }

  const hasCondition = data.some((p) => {
    const legacyStudyCondition = (p as { studyCondition?: string | string[] }).studyCondition;
    return parseConditionParam(p.conditions ?? legacyStudyCondition ?? p.searchParams?.condition).length > 0;
  });
  const header = combinedProperties.filter((p) => p !== 'condition' || hasCondition);
  const allData = await Promise.all(data.map(async (participant) => {
    const partDataToRows = await participantDataToRows(participant, combinedProperties, allConfigs[participant.participantConfigHash], transcripts);

    return partDataToRows;
  }));

  const rows = allData.map((partData) => partData[0]);
  const newHeaders = new Set(allData.map((partData) => partData[1]).flat());

  const flatRows = rows.flat().sort((a, b) => (a !== b ? a.participantId.localeCompare(b.participantId) : a.trialOrder - b.trialOrder));

  return { header: [...header, ...newHeaders], rows: flatRows };
}

export function DownloadTidy({
  opened,
  close,
  filename,
  data,
  studyId,
  hasAudio,
}: {
  opened: boolean;
  close: () => void;
  filename: string;
  data: ParticipantData[];
  studyId: string;
  hasAudio?: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showTranscriptWarning, setShowTranscriptWarning] = useState(false);

  const [selectedProperties, setSelectedProperties] = useState<Array<OptionalProperty>>([
    'condition',
    'stage',
    'status',
    'rejectReason',
    'description',
    'rejectTime',
    'percentComplete',
    'instruction',
    'responsePrompt',
    'answer',
    'correctAnswer',
    'duration',
    'cleanedDuration',
  ]);

  const { storageEngine } = useStorageEngine();
  const { value: tableData, status: tableDataStatus, error: tableError } = useAsync(getTableData, [selectedProperties, data, storageEngine, studyId, hasAudio]);
  const isFirebase = storageEngine?.getEngine() === 'firebase';
  const transcriptAvailable = isFirebase && !!hasAudio;
  const selectedParticipantCount = data.length;
  const warnLargeTranscriptDownload = selectedProperties.includes('transcript') && selectedParticipantCount > 50;

  const downloadTidy = useCallback(async (skipWarning = false) => {
    if (!tableData) {
      return;
    }

    if (warnLargeTranscriptDownload && !skipWarning) {
      setShowTranscriptWarning(true);
      return;
    }

    setShowTranscriptWarning(false);

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const lines: string[] = [tableData.header.join(',')];
      const totalRows = tableData.rows.length;

      const chunkSize = 100;
      const buildCsv = async (): Promise<void> => {
        let startIndex = 0;

        while (startIndex < totalRows) {
          const endIndex = Math.min(startIndex + chunkSize, totalRows);

          for (let index = startIndex; index < endIndex; index += 1) {
            const row = tableData.rows[index];
            const serializedRow = tableData.header.map((header) => {
              const rawValue = row[header] ?? '';
              const fieldValue = typeof rawValue === 'object' ? JSON.stringify(rawValue) : `${rawValue}`;
              // Escape double quotes by replacing them with two double quotes
              const escapedValue = fieldValue.replace(/"/g, '""');
              return `"${escapedValue}"`; // Double-quote the field value
            }).join(',');
            lines.push(serializedRow);
          }

          setDownloadProgress(totalRows === 0 ? 100 : Math.round((endIndex / totalRows) * 100));
          startIndex = endIndex;

          if (startIndex < totalRows) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 0);
            });
          }
        }
      };

      await buildCsv();

      download(lines.join('\n'), filename);
    } finally {
      setDownloadProgress(100);
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 250);
    }
  }, [filename, tableData, warnLargeTranscriptDownload]);

  const handlePythonExportTIDY = useCallback(() => {
    if (!tableData) {
      return;
    }

    window.parent.postMessage({ type: 'revisitWidget/PYTHON_EXPORT_TIDY', payload: tableData }, '*');
    showNotification({ title: 'Success', message: 'Data sent to python notebook', color: 'green' });
  }, [tableData]);

  const caption = useMemo(() => {
    if (!tableData) {
      return '';
    }

    const numRowsShown = tableData.rows.length > 5 ? 5 : tableData.rows.length;
    const plural = numRowsShown === 1 ? '' : 's';
    return `This is a preview of the first ${plural ? numRowsShown : ''} row${plural} of the CSV. The full CSV contains ${tableData.rows.length} row${plural}.`;
  }, [tableData]);

  return (
    <Modal
      opened={opened}
      size="90%"
      onClose={close}
      title="Tidy CSV Exporter"
      centered
      withCloseButton={false}
      closeOnClickOutside={!(isDownloading || (showTranscriptWarning && warnLargeTranscriptDownload))}
      closeOnEscape={!(isDownloading || (showTranscriptWarning && warnLargeTranscriptDownload))}
    >
      {showTranscriptWarning && warnLargeTranscriptDownload && (
        <Alert color="orange" icon={<IconAlertTriangle />} mb="sm">
          This export includes transcripts for
          {' '}
          {selectedParticipantCount}
          {' '}
          selected participants, so it may take a while.
        </Alert>
      )}
      {isDownloading && (
        <Progress value={downloadProgress} animated />
      )}
      <Box>
        <Text size="sm" fw={500} mb="xs">
          <Flex align="center" gap="xs">
            <IconLayoutColumns size={16} />
            Optional columns:
          </Flex>
        </Text>
        <Flex wrap="wrap" gap="4px">
          {OPTIONAL_COMMON_PROPS.filter((prop) => prop !== 'transcript' || transcriptAvailable).map((prop) => {
            const isSelected = selectedProperties.includes(prop);

            const button = (
              <Button
                key={prop}
                variant={isSelected ? 'light' : 'white'}
                color={isSelected ? 'blue' : 'gray'}
                size="xs"
                onClick={() => {
                  if (isSelected) {
                    setSelectedProperties(selectedProperties.filter((p) => p !== prop));
                  } else {
                    setSelectedProperties([...selectedProperties, prop]);
                  }
                }}
                styles={{
                  root: {
                    fontSize: '14px',
                    height: 'auto',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  },
                }}
              >
                {prop}
              </Button>
            );

            return button;
          })}
        </Flex>
      </Box>

      <Space h="md" />

      <Box h={400} style={{ width: '100%', overflow: 'scroll' }}>
        {tableDataStatus === 'success' && tableData
          ? (
            <Table striped captionSide="bottom" withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {tableData.header.map((header) => (
                    <Table.Th
                      key={header}
                      style={{
                        whiteSpace: 'nowrap',
                        minWidth: ['description', 'instruction', 'participantId'].includes(header) ? 200 : undefined,
                      }}
                    >
                      <Flex direction="row" justify="space-between" align="center">
                        {header}
                        {!REQUIRED_PROPS.includes(header as never) && (
                          <ActionIcon onClick={() => setSelectedProperties(selectedProperties.filter((prop) => prop !== header))} style={{ marginBottom: -3, marginLeft: 8 }} variant="subtle" color="gray">
                            <IconX size={16} />
                          </ActionIcon>
                        )}
                      </Flex>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tableData.rows.slice(0, 5).map((row, index) => (
                  <Table.Tr key={index}>
                    {tableData.header.map((header) => (
                      <Table.Td
                        key={`${index} - ${header}`}
                        style={{
                          whiteSpace: ['description', 'instruction', 'participantId'].includes(header) ? 'normal' : 'nowrap',
                        }}
                      >
                        {row[header]}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : tableDataStatus === 'error' && tableError ? <Alert variant="light">{tableError.message}</Alert> : null}
        <LoadingOverlay visible={tableDataStatus === 'pending' || tableDataStatus === 'idle'} />
      </Box>

      <Space h="sm" />

      <Flex justify="center" fz="sm" c="dimmed">
        <Text>{caption}</Text>
      </Flex>

      <Space h="md" />

      <Group justify="right">
        {!(showTranscriptWarning && warnLargeTranscriptDownload) && (
          <Button onClick={close} color="dark" variant="subtle" disabled={isDownloading}>
            Close
          </Button>
        )}

        {showTranscriptWarning && warnLargeTranscriptDownload && (
          <Button
            variant="subtle"
            color="gray"
            onClick={() => setShowTranscriptWarning(false)}
            disabled={isDownloading}
          >
            Cancel
          </Button>
        )}

        <Button
          leftSection={<IconTableExport />}
          onClick={() => { downloadTidy(showTranscriptWarning); }}
          data-autofocus
          disabled={isDownloading || !tableData}
          color={showTranscriptWarning && warnLargeTranscriptDownload ? 'orange' : undefined}
        >
          {showTranscriptWarning && warnLargeTranscriptDownload ? 'Continue Download' : 'Download'}
        </Button>

        {
          studyId === '__revisit-widget' && (
            <Button
              onClick={handlePythonExportTIDY}
              disabled={isDownloading}
            >
              <IconBrandPython />
            </Button>
          )
        }
      </Group>
    </Modal>
  );
}
