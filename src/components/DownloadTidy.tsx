import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Group,
  Modal,
  MultiSelect,
  Space,
  Table,
  Text,
} from '@mantine/core';
import { IconLayoutColumns, IconTableExport, IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import merge from 'lodash.merge';
import { ParticipantData } from '../storage/types';
import {
  Answer, IndividualComponent, Prettify, StudyConfig,
} from '../parser/types';
import { isInheritedComponent } from '../parser/parser';
import { getSequenceFlatMap } from '../utils/getSequenceFlatMap';

export const OPTIONAL_COMMON_PROPS = [
  'status',
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
  'meta',
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

function participantDataToRows(participant: ParticipantData, studyConfig: StudyConfig, properties: Property[]): TidyRow[] {
  const percentComplete = ((Object.entries(participant.answers).length / (getSequenceFlatMap(participant.sequence).length - 1)) * 100).toFixed(2);
  return Object.entries(participant.answers).map(([trialIdentifier, trialAnswer]) => {
    // Get the whole component, including the base component if there is inheritance
    const trialId = trialIdentifier.split('_').slice(0, -1).join('_');
    const trialOrder = parseInt(`${trialIdentifier.split('_').at(-1)}`, 10);
    const trialConfig = studyConfig.components[trialId];
    const completeComponent: IndividualComponent = isInheritedComponent(trialConfig) && trialConfig.baseComponent && studyConfig.baseComponents
      ? merge({}, studyConfig.baseComponents[trialConfig.baseComponent], trialConfig)
      : trialConfig;

    const duration = trialAnswer.endTime - trialAnswer.startTime;

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
      if (properties.includes('meta')) {
        tidyRow.meta = JSON.stringify(completeComponent.meta, null, 2);
      }

      return tidyRow;
    }).flat();

    return rows;
  }).flat();
}

export function DownloadTidy({
  opened,
  close,
  filename,
  studyConfig,
  data,
}: {
  opened: boolean;
  close: () => void;
  filename: string;
  studyConfig: StudyConfig;
  data: ParticipantData[];
}) {
  const [selectedProperties, setSelectedProperties] = useState<Array<OptionalProperty>>([...OPTIONAL_COMMON_PROPS].filter((prop) => prop !== 'meta'));

  const tableData = useMemo(() => {
    const combinedProperties = [...REQUIRED_PROPS, ...selectedProperties];

    const header = combinedProperties;
    const rows = data
      .map((participant) => participantDataToRows(participant, studyConfig, combinedProperties))
      .flat()
      .sort((a, b) => (a !== b ? a.participantId.localeCompare(b.participantId) : a.trialOrder - b.trialOrder));

    return { header, rows };
  }, [data, selectedProperties, studyConfig]);

  const downloadTidy = useCallback(() => {
    const csv = [
      tableData.header.join(','),
      ...tableData.rows.map((row) => tableData.header.map((header) => row[header]).join(',')),
    ].join('\n');
    download(csv, filename);
  }, [filename, tableData.header, tableData.rows]);

  const caption = useMemo(() => {
    const numRowsShown = tableData.rows.length > 5 ? 5 : tableData.rows.length;
    const plural = numRowsShown === 1 ? '' : 's';
    return `This is a preview of the first ${plural ? numRowsShown : ''} row${plural} of the CSV. The full CSV contains ${tableData.rows.length} row${plural}.`;
  }, [tableData.rows]);

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
        nothingFound="Property not found"
        data={[...OPTIONAL_COMMON_PROPS]}
        value={selectedProperties}
        onChange={(values: OptionalProperty[]) => setSelectedProperties(values)}
        label="Included optional columns:"
        icon={<IconLayoutColumns />}
        variant="filled"
      />

      <Space h="md" />

      <Box mih={300} style={{ width: '100%', overflow: 'scroll' }}>
        <Table striped captionSide="bottom" withBorder>
          <thead>
            <tr>
              {tableData.header.map((header) => (
                <th
                  key={header}
                  style={{
                    whiteSpace: 'nowrap',
                    minWidth: ['description', 'instruction', 'participantId'].includes(header) ? 200 : undefined,
                  }}
                >
                  <Flex direction="row" justify="space-between" align="center">
                    {header}
                    {!REQUIRED_PROPS.includes(header as never) && (
                    <ActionIcon onClick={() => setSelectedProperties(selectedProperties.filter((prop) => prop !== header))} style={{ marginBottom: -3, marginLeft: 8 }}>
                      <IconX size={16} />
                    </ActionIcon>
                    )}
                  </Flex>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.slice(0, 5).map((row, index) => (
              <tr key={index}>
                {tableData.header.map((header) => (
                  <td
                    key={`${index}-${header}`}
                    style={{
                      whiteSpace: ['description', 'instruction', 'participantId'].includes(header) ? 'normal' : 'nowrap',
                    }}
                  >
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>

      <Space h="sm" />

      <Flex justify="center" fz="sm" c="dimmed">
        <Text>{caption}</Text>
      </Flex>

      <Space h="md" />

      <Group position="right">
        <Button onClick={close} color="dark" variant="subtle">
          Close
        </Button>
        <Button
          leftIcon={<IconTableExport />}
          onClick={() => downloadTidy()}
          data-autofocus
        >
          Download
        </Button>
      </Group>
    </Modal>
  );
}
