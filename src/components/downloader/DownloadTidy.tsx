/* eslint-disable no-nested-ternary */
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Flex,
  Group,
  LoadingOverlay,
  Modal,
  MultiSelect,
  Space,
  Table,
  Text,
} from '@mantine/core';
import {
  IconBrandPython, IconLayoutColumns, IconTableExport, IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import merge from 'lodash.merge';
import { ParticipantData } from '../../storage/types';
import {
  Answer, IndividualComponent, Prettify, StudyConfig,
} from '../../parser/types';
import { isInheritedComponent } from '../../parser/utils';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { StorageEngine } from '../../storage/engines/StorageEngine';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAsync } from '../../store/hooks/useAsync';
import { getCleanedDuration } from '../../utils/getCleanedDuration';
import { showNotification } from '../../utils/notifications';

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
  'responseMin',
  'responseMax',
  'startTime',
  'endTime',
  'duration',
  'cleanedDuration',
  'meta',
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
export type TidyRow = Prettify<Record<RequiredProperty, any> & Partial<Record<OptionalProperty | MetaProperty, any>>>;

export function download(graph: string, filename: string) {
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(graph)}`;
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', filename);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function participantDataToRows(participant: ParticipantData, properties: Property[], studyConfig: StudyConfig): TidyRow[] {
  const percentComplete = ((Object.entries(participant.answers).filter(([_, entry]) => entry.endTime !== -1).length / (getSequenceFlatMap(participant.sequence).length - 1)) * 100).toFixed(2);
  return [
    {
      participantId: participant.participantId,
      trialId: 'participantTags',
      trialOrder: null,
      responseId: 'participantTags',
      answer: JSON.stringify(participant.participantTags),
    },
    ...Object.entries(participant.answers).map(([trialIdentifier, trialAnswer]) => {
      // Get the whole component, including the base component if there is inheritance
      const trialId = trialIdentifier.split('_').slice(0, -1).join('_');
      const trialOrder = parseInt(`${trialIdentifier.split('_').at(-1)}`, 10);
      const trialConfig = studyConfig.components[trialId];
      const completeComponent: IndividualComponent = isInheritedComponent(trialConfig) && trialConfig.baseComponent && studyConfig.baseComponents
        ? merge({}, studyConfig.baseComponents[trialConfig.baseComponent], trialConfig)
        : trialConfig;

      const duration = trialAnswer.endTime === -1 ? undefined : trialAnswer.endTime - trialAnswer.startTime;
      const cleanedDuration = getCleanedDuration(trialAnswer);

      const rows = Object.entries(trialAnswer.answer).map(([key, value]) => {
        const tidyRow: TidyRow = {
          participantId: participant.participantId,
          trialId,
          trialOrder,
          responseId: key,
        };

        const response = completeComponent.response.find((resp) => resp.id === key);
        if (properties.includes('status')) {
          // eslint-disable-next-line no-nested-ternary
          tidyRow.status = participant.rejected ? 'rejected' : (participant.completed ? 'completed' : 'in progress');
        }
        if (properties.includes('rejectReason')) {
          tidyRow.rejectReason = participant.rejected ? participant.rejected.reason : undefined;
        }
        if (properties.includes('rejectTime')) {
          tidyRow.rejectTime = participant.rejected ? new Date(participant.rejected.timestamp).toISOString() : undefined;
        }
        if (properties.includes('configHash')) {
          // eslint-disable-next-line no-nested-ternary
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
          tidyRow.answer = value;
        }
        if (properties.includes('correctAnswer')) {
          const correctAnswer = (completeComponent.correctAnswer as Answer[])?.find((ans) => ans.id === key)?.answer;
          tidyRow.correctAnswer = typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : correctAnswer;
        }
        if (properties.includes('responseMin')) {
          tidyRow.responseMin = response?.type === 'numerical' ? response.min : undefined;
        }
        if (properties.includes('responseMax')) {
          tidyRow.responseMax = response?.type === 'numerical' ? response.max : undefined;
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

        return tidyRow;
      }).flat();

      return rows;
    }).flat()];
}

async function getTableData(selectedProperties: Property[], data: ParticipantData[], storageEngine: StorageEngine | undefined, studyId: string) {
  if (!storageEngine) {
    return { header: [], rows: [] };
  }

  const combinedProperties = [...REQUIRED_PROPS, ...selectedProperties];

  const allConfigHashes = [...new Set(data.map((part) => part.participantConfigHash))];
  const allConfigs = await storageEngine.getAllConfigsFromHash(allConfigHashes, studyId);

  const header = combinedProperties;
  const rows = await Promise.all(data.map(async (participant) => {
    const partDataToRows = await participantDataToRows(participant, combinedProperties, allConfigs[participant.participantConfigHash]);

    return partDataToRows;
  }));

  const flatRows = rows.flat().sort((a, b) => (a !== b ? a.participantId.localeCompare(b.participantId) : a.trialOrder - b.trialOrder));

  return { header, rows: flatRows };
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
  const [selectedProperties, setSelectedProperties] = useState<Array<OptionalProperty>>([...OPTIONAL_COMMON_PROPS].filter((prop) => prop !== 'meta'));

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
      <MultiSelect
        searchable
        nothingFoundMessage="Property not found"
        data={[...OPTIONAL_COMMON_PROPS]}
        value={selectedProperties}
        onChange={(values: string[]) => setSelectedProperties(values as OptionalProperty[])}
        label="Included optional columns:"
        leftSection={<IconLayoutColumns />}
        variant="filled"
      />

      <Space h="md" />

      <Box mih={300} style={{ width: '100%', overflow: 'scroll' }}>
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
