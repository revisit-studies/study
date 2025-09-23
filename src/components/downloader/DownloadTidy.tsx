import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Flex,
  Group,
  LoadingOverlay,
  Modal,
  Space,
  Table,
  Text,
} from '@mantine/core';
import {
  IconBrandPython, IconLayoutColumns, IconTableExport, IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { ParticipantData } from '../../storage/types';
import { Prettify, StudyConfig } from '../../parser/types';
import { StorageEngine } from '../../storage/engines/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAsync } from '../../store/hooks/useAsync';
import { getCleanedDuration } from '../../utils/getCleanedDuration';
import { showNotification } from '../../utils/notifications';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';

export const OPTIONAL_COMMON_PROPS = [
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
  'startTime',
  'endTime',
  'responseMin',
  'responseMax',
  'configHash',
] as const;

export const REQUIRED_PROPS = [
  'participantId',
  'trialId',
  'trialOrder',
  'responseId',
] as const;

type OptionalProperty = (typeof OPTIONAL_COMMON_PROPS)[number];
type RequiredProperty = (typeof REQUIRED_PROPS)[number];
type MetaProperty = `meta-${string}`;

export type Property = OptionalProperty | RequiredProperty | MetaProperty;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TidyRow = Prettify<Record<RequiredProperty, any> & Partial<Record<OptionalProperty | MetaProperty, any>>> & Record<string, number | string[] | boolean | string | null>;

export function download(graph: string, filename: string) {
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(graph)}`;
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', filename);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function participantDataToRows(participant: ParticipantData, properties: Property[], studyConfig: StudyConfig): [TidyRow[], string[]] {
  const percentComplete = ((Object.entries(participant.answers).filter(([_, entry]) => entry.endTime !== -1).length / (Object.entries(participant.answers).length)) * 100).toFixed(2);
  const newHeaders = new Set<string>();

  return [[
    {
      participantId: participant.participantId,
      trialId: 'participantTags',
      trialOrder: null,
      responseId: 'participantTags',
      answer: JSON.stringify(participant.participantTags),
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
      } as TidyRow);

      return rows;
    }).flat()], Array.from(newHeaders)];
}

async function getTableData(selectedProperties: Property[], data: ParticipantData[], storageEngine: StorageEngine | undefined, studyId: string) {
  if (!storageEngine) {
    return { header: [], rows: [] };
  }

  const combinedProperties = [...REQUIRED_PROPS, ...selectedProperties];

  const allConfigHashes = [...new Set(data.map((part) => part.participantConfigHash))];
  const allConfigs = await storageEngine.getAllConfigsFromHash(allConfigHashes, studyId);

  const header = combinedProperties;
  const allData = await Promise.all(data.map(async (participant) => {
    const partDataToRows = await participantDataToRows(participant, combinedProperties, allConfigs[participant.participantConfigHash]);

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
}: {
  opened: boolean;
  close: () => void;
  filename: string;
  data: ParticipantData[];
  studyId: string;
}) {
  const [selectedProperties, setSelectedProperties] = useState<Array<OptionalProperty>>([
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

  const storageEngine = useStorageEngine();
  const { value: tableData, status: tableDataStatus, error: tableError } = useAsync(getTableData, [selectedProperties, data, storageEngine.storageEngine, studyId]);

  const downloadTidy = useCallback(() => {
    if (!tableData) {
      return;
    }

    const csv = [
      tableData.header.join(','),
      ...tableData.rows.map((row) => tableData.header.map((header) => {
        const fieldValue = `${row[header]}`;
        // Escape double quotes by replacing them with two double quotes
        const escapedValue = fieldValue.replace(/"/g, '""');
        return `"${escapedValue}"`; // Double-quote the field value
      }).join(',')),
    ].join('\n');
    download(csv, filename);
  }, [filename, tableData]);

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
    >
      <Box>
        <Text size="sm" fw={500} mb="xs">
          <Flex align="center" gap="xs">
            <IconLayoutColumns size={16} />
            Optional columns:
          </Flex>
        </Text>
        <Flex wrap="wrap" gap="4px">
          {OPTIONAL_COMMON_PROPS.map((prop) => {
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
                        key={`${index}-${header}`}
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
        <Button onClick={close} color="dark" variant="subtle">
          Close
        </Button>
        <Button
          leftSection={<IconTableExport />}
          onClick={downloadTidy}
          data-autofocus
        >
          Download
        </Button>
        {studyId === '__revisit-widget' && (
          <Button
            onClick={handlePythonExportTIDY}
          >
            <IconBrandPython />
          </Button>
        )}
      </Group>
    </Modal>
  );
}
