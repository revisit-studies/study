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
import { useStudyId } from '../routes';
import {
  downloadTidy,
  OPTIONAL_COMMON_PROPS,
  Property,
  REQUIRED_PROPS,
} from '../storage/downloadTidy';
import { useStoreSelector } from '../store/store';

type Props = {
  filename: string;
  opened: boolean;
  close: () => void;
};

export function DownloadTidy({ opened, close, filename }: Props) {
  const studyId = useStudyId();
  const sequence = useStoreSelector((state) => state.unTrrackedSlice.config.components);

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
          onClick={() => {
            downloadTidy(
              // fb,
              // studyId,
              // Object.keys(sequence),
              // selectedProperties,
              // `${filename}.csv`
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
