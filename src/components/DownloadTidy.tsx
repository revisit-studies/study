import {
  Box,
  Button,
  Checkbox,
  Flex,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Text,
} from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { IconTable } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { SteppedComponent } from '../parser/types';
import {
  downloadTidy,
  OPTIONAL_COMMON_PROPS,
  ParticipantLoadQuery,
  PARTICIPANT_LOAD_OPTS,
  Property,
  REQUIRED_PROPS,
} from '../storage/downloadTidy';
import { useFirebase } from '../storage/init';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

type Props = {
  opened: boolean;
  close: () => void;
};

function useTrialGroups() {
  const config = useStudyConfig();

  const trialGroups = useMemo(() => {
    const { sequence, components } = config;

    const trialLike = sequence.filter(
      (seq) =>
        components[seq].type === 'trials' || components[seq].type === 'practice'
    );

    return trialLike;
  }, [config]);

  return trialGroups;
}

function useTrialMetaProps(trialGroups: string[]): Array<`meta-${string}`> {
  const config = useStudyConfig();

  const metaProps = useMemo(() => {
    const mProps: string[] = [];
    const trialComponents = trialGroups.map(
      (t) => config.components[t]
    ) as SteppedComponent[];

    trialComponents.forEach((group) => {
      const metadatas = Object.values(group.trials).map((tr) =>
        Object.keys(tr.meta || {})
      );

      metadatas.forEach((md) => mProps.push(...md));
    });

    const unique = [...new Set(mProps)];

    return unique.map((u) => `meta-${u}`) as Array<`meta-${string}`>;
  }, [config, trialGroups]);

  return metaProps;
}

export function DownloadTidy({ opened, close }: Props) {
  const fb = useFirebase();
  const trialGroups = useTrialGroups();
  const metaProps = useTrialMetaProps(trialGroups);

  const [selectedProperties, setSelectedProperties] = useInputState<
    Array<Property>
  >([...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS, ...metaProps]);

  const [participantLoadQuery, setParticipantLoadQuery] =
    useInputState<ParticipantLoadQuery>(PARTICIPANT_LOAD_OPTS[0]);

  const [selectedTrialGroups, setSelectedTrialGroups] = useInputState<string[]>(
    trialGroups.slice(0, 3)
  );

  const setSelected = useCallback((values: Property[]) => {
    if (REQUIRED_PROPS.every((rp) => values.includes(rp)))
      setSelectedProperties(values);
  }, []);

  const combinedProperties = useMemo(() => {
    return [...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS, ...metaProps];
  }, [metaProps]);

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
      <Box mt="1em">
        <Checkbox.Group
          label={
            <Text fw="bold" size="lg">
              Select trial groups to include:
            </Text>
          }
          value={selectedTrialGroups}
          onChange={(val: string[]) => {
            setSelectedTrialGroups(val);
          }}
        >
          {trialGroups.map((tg) => (
            <Checkbox key={tg} value={tg} label={tg} />
          ))}
        </Checkbox.Group>
      </Box>

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

      <Box mt="1em">
        <Text fw="bold" size="lg">
          How many participants to include in tidy csv?
        </Text>
        <Flex
          direction={{
            base: 'column',
            sm: 'row',
          }}
          gap={{
            base: 'sm',
            sm: 'lg',
          }}
          justify={{
            sm: 'start',
          }}
        >
          <Select
            data={PARTICIPANT_LOAD_OPTS}
            value={participantLoadQuery.value}
            onChange={(value) => {
              const newValue = PARTICIPANT_LOAD_OPTS.find(
                (p) => p.value === value
              );

              const count =
                value === 'all'
                  ? undefined
                  : participantLoadQuery.count || newValue?.count;

              if (newValue)
                setParticipantLoadQuery({
                  ...newValue,
                  count,
                });
            }}
          />
          <NumberInput
            disabled={
              participantLoadQuery.value === 'all' ||
              !participantLoadQuery.count
            }
            value={participantLoadQuery.count || undefined}
            onChange={(ev) => {
              setParticipantLoadQuery({ ...participantLoadQuery, count: ev });
            }}
          />
        </Flex>
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
          onClick={() => {
            downloadTidy(
              fb,
              selectedTrialGroups,
              selectedProperties,
              participantLoadQuery
            );
          }}
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
