import {
  Box,
  Button,
  Checkbox,
  Flex,
  Modal,
  MultiSelect,
  Text,
} from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { IconTable } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { ContainerComponent, IndividualComponent } from '../parser/types';
import { useStudyId } from '../routes';
import {
  downloadTidy,
  OPTIONAL_COMMON_PROPS,
  Property,
  REQUIRED_PROPS,
} from '../storage/downloadTidy';
import { useFirebase } from '../storage/init';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

type Props = {
  filename: string;
  opened: boolean;
  close: () => void;
};

function useTrialGroups() {
  const config = useStudyConfig();

  const trialGroups = useMemo(() => {
    const { sequence, components } = config;

    const trialLike = sequence.filter(
      (seq) =>
        components[seq].type === 'container'
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
    ) as ContainerComponent[];

    trialComponents.forEach((group) => {
      const metadatas = Object.values(group.components).map((tr) =>
        Object.keys((tr as IndividualComponent).meta || {})
      );

      metadatas.forEach((md) => mProps.push(...md));
    });

    const unique = [...new Set(mProps)];

    return unique.map((u) => `meta-${u}`) as Array<`meta-${string}`>;
  }, [config, trialGroups]);

  return metaProps;
}

export function DownloadTidy({ opened, close, filename }: Props) {
  const fb = useFirebase();
  const studyId = useStudyId();

  const trialGroups = useTrialGroups();
  const metaProps = useTrialMetaProps(trialGroups);

  const [selectedProperties, setSelectedProperties] = useInputState<
    Array<Property>
  >([...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS, ...metaProps]);

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
              studyId,
              selectedTrialGroups,
              selectedProperties,
              `${filename}.csv`
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
