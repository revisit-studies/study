import {
  Button, Flex, Paper, Stack, Table,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconDownload, IconEye } from '@tabler/icons-react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { ParticipantData } from '../../../storage/types';

interface ConfigInfo {
  version: string;
  date: string;
  hash: string;
  participantCount: number;
}

export function ConfigView({ visibleParticipants, studyId }: { visibleParticipants: ParticipantData[], studyId?: string }) {
  const { storageEngine } = useStorageEngine();
  const [configInfos, setConfigInfos] = useState<ConfigInfo[]>([]);

  useEffect(() => {
    if (!storageEngine || !studyId) {
      setConfigInfos([]);
      return;
    }

    const fetchConfigs = async () => {
      const allConfigHashes = [...new Set(visibleParticipants.map((p) => p.participantConfigHash))];
      const configs = await storageEngine.getAllConfigsFromHash(allConfigHashes, studyId);

      const data = Object.entries(configs).map(([hash, config]) => ({
        version: config.studyMetadata.version,
        date: config.studyMetadata.date,
        hash,
        participantCount: visibleParticipants.filter((p) => p.participantConfigHash === hash).length,
      }));

      setConfigInfos(data);
    };

    fetchConfigs();
  }, [visibleParticipants, storageEngine, studyId]);

  return (
    <Stack gap="md">
      <Paper shadow="sm" p="md" withBorder>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Index</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Hash</Table.Th>
              <Table.Th>Participants</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {configInfos.map((data, index) => (
              <Table.Tr key={index}>
                <Table.Td>{index + 1}</Table.Td>
                <Table.Td>{data.version}</Table.Td>
                <Table.Td>{data.date}</Table.Td>
                <Table.Td>{data.hash}</Table.Td>
                <Table.Td>{data.participantCount}</Table.Td>
                <Table.Td>
                  <Flex gap="xs">
                    <Button variant="light">
                      <IconEye size={16} />
                      View
                    </Button>
                    <Button variant="light">
                      <IconDownload size={16} />
                      Download
                    </Button>
                  </Flex>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
