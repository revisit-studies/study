import {
  Box,
  Button,
  Flex,
  Modal,
  MultiSelect,
  Text,
} from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { IconTable } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { StorageEngine } from '../storage/engines/StorageEngine';
import { download } from './DownloadPanel';
import { ParticipantData } from '../storage/types';
import { useStorageEngine } from '../store/storageEngineHooks';
import { Prettify, StudyConfig } from '../parser/types';
import { isPartialComponent } from '../parser/parser';
import merge from 'lodash.merge';
import { StoredAnswer } from '../store/types';

export const OPTIONAL_COMMON_PROPS = [
  'description',
  'instruction',
  'answer',
  'correctAnswer',
  'startTime',
  'endTime',
  'duration',
] as const;

export const REQUIRED_PROPS = [
  'participantId',
  'trialId',
  'responseId',
] as const;

type OptionalProperty = (typeof OPTIONAL_COMMON_PROPS)[number];
type RequiredProperty = (typeof REQUIRED_PROPS)[number];
type MetaProperty = `meta-${string}`;

export type Property = OptionalProperty | RequiredProperty | MetaProperty;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TidyRow = Prettify<Record<RequiredProperty, any> & Partial<Record<OptionalProperty | MetaProperty, any>>>;

export async function downloadTidy(
  properties: Property[] = [...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS],
  filename: string,
  storageEngine: StorageEngine,
  studyConfig: StudyConfig,
) {
  const allParticipantData = await storageEngine.getAllParticpantsData();

  const rows = allParticipantData
    .map((participantSession) => processToRow(participantSession, studyConfig))
    .flat();

  const escapeDoubleQuotes = (s: string) => s.replace(/"/g, '""');

  const csvRows = rows.map((row) =>
    properties
      .map((header) => {
        if (row === null) {
          return '';
        } else if (typeof row[header] === 'string') {
          return `"${escapeDoubleQuotes(row[header])}"`;
        } else {
          return JSON.stringify(row[header]);
        }
      })
      .join(',')
  );
  const csv = [properties.join(','), ...csvRows].join('\n');

  download(csv, filename);
}

function processToRow(session: ParticipantData, studyConfig: StudyConfig): TidyRow[] {
  return Object.entries(studyConfig.components).map(([trialId, trialConfig]) => {
    // Get the whole component, including the base component if there is inheritance
    const completeComponent = isPartialComponent(trialConfig) && trialConfig.baseComponent && studyConfig.baseComponents ? merge(studyConfig.baseComponents[trialConfig.baseComponent], trialConfig) : trialConfig;

    // Get the answer for this trial or an empty answer if it doesn't exist
    const trialAns = session.answers[trialId];
    const trialAnswer: StoredAnswer = trialAns !== undefined ? trialAns : { answer: {}, startTime: -1, endTime: -1 };

    const duration = trialAnswer.endTime - trialAnswer.startTime;

    const rows = Object.entries(trialAnswer.answer).map(([key, value]) => {
      return {
        participantId: session.participantId,
        trialId,
        responseId: key,
        description: completeComponent.description,
        instruction: completeComponent.instruction,
        answer: value,
        correctAnswer: completeComponent.correctAnswer,
        startTime: new Date(trialAnswer.startTime).toUTCString(),
        endTime: new Date(trialAnswer.endTime).toUTCString(),
        duration,
      } as TidyRow;
    }).flat();

    return rows;
  }).flat();
}


type Props = {
  opened: boolean;
  close: () => void;
  filename: string;
  studyConfig: StudyConfig;
};

export function DownloadTidy({ opened, close, filename, studyConfig }: Props) {
  const [selectedProperties, setSelectedProperties] = useInputState<
    Array<Property>
  >([...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS]);

  const setSelected = useCallback((values: Property[]) => {
    if (REQUIRED_PROPS.every((rp) => values.includes(rp)))
      setSelectedProperties(values);
  }, [setSelectedProperties]);

  const combinedProperties = useMemo(() => {
    return [...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS];
  }, []);

  const { storageEngine } = useStorageEngine();

  if (!storageEngine) return null;

  return (
    <Modal
      opened={opened}
      size="lg"
      onClose={close}
      title={<Text size="xl">Download Tidy CSV</Text>}
      centered
      radius="md"
      padding="xl"
    >
      <Box>
        <MultiSelect
          searchable
          limit={30}
          nothingFound="Property not found"
          data={combinedProperties}
          value={selectedProperties}
          onChange={setSelected}
          label={
            <Text fw="bold" size="lg">
              Select properties to include in tidy csv:
            </Text>
          }
          placeholder="Select atleast one property"
        />
      </Box>

      <Flex
        mt="xl"
        direction={{
          base: 'column',
          sm: 'row',
        }}
        gap={{
          base: 'sm',
          sm: 'lg',
        }}
        justify={{
          sm: 'space-around',
        }}
      >
        <Button
          leftIcon={<IconTable />}
          onClick={() => downloadTidy(selectedProperties, filename, storageEngine, studyConfig)}
        >
          Download
        </Button>
        <Button onClick={close} color="red">
          Close
        </Button>
      </Flex>
    </Modal>
  );
}
