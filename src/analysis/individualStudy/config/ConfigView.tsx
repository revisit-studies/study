/* eslint-disable react/no-unstable-nested-components */
import {
  Button, Code, Flex, Space, Text,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell as MrtCell, MRT_ColumnDef as MrtColumnDef, MRT_RowSelectionState as MrtRowSelectionState, useMantineReactTable,
} from 'mantine-react-table';
import { IconDownload, IconEye } from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';

interface ConfigInfo {
  version: string;
  date: string;
  hash: string;
  participantCount: number;
  config: StudyConfig;
}

export function ConfigView({
  visibleParticipants,
}: {
  visibleParticipants: ParticipantData[];
}) {
  const { studyId } = useParams();
  const { storageEngine } = useStorageEngine();
  const [checked, setChecked] = useState<MrtRowSelectionState>({});
  const [configs, setConfigs] = useState<ConfigInfo[]>([]);

  useEffect(() => {
    if (!storageEngine || !studyId) {
      setConfigs([]);
      return;
    }

    const fetchConfigs = async () => {
      const allConfigHashes = [...new Set(
        visibleParticipants
          .map((participant) => participant.participantConfigHash),
      )];

      const fetchedConfigs = await storageEngine.getAllConfigsFromHash(allConfigHashes, studyId);

      const rows = Object.entries(fetchedConfigs).map(([hash, config]) => ({
        version: config.studyMetadata?.version || '',
        date: config.studyMetadata?.date || '',
        hash,
        participantCount: visibleParticipants.filter((participant) => participant.participantConfigHash === hash).length,
        config,
      }));

      setConfigs(rows);
    };

    fetchConfigs();
  }, [visibleParticipants, storageEngine, studyId]);

  const columns = useMemo<MrtColumnDef<ConfigInfo>[]>(() => [
    {
      accessoryKey: 'configIndex',
      header: '#',
      size: 20,
    },
    {
      accessorKey: 'version',
      header: 'Version',
      size: 50,
    },
    {
      accessorKey: 'date',
      header: 'Date',
      maxSize: 100,
    },
    {
      accessorKey: 'hash',
      header: 'Hash',
      minSize: 250,
      Cell: ({ cell }: { cell: MrtCell<ConfigInfo, string> }) => (
        <Code>{cell.getValue()}</Code>
      ),
    },
    {
      accessorKey: 'participantCount',
      header: 'Participants',
      size: 100,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      Cell: () => (
        <Flex gap="sm">
          <Button size="xs" variant="light">
            <IconEye size={14} />
            View
          </Button>
          <Button size="xs" variant="light">
            <IconDownload size={14} />
            Download
          </Button>
        </Flex>
      ),
    },
  ], []);

  const table = useMantineReactTable({
    columns,
    data: configs,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    enableRowSelection: true,
    getRowId: (originalRow) => originalRow.hash,
    onRowSelectionChange: setChecked,
    manualPagination: true,
    state: { rowSelection: checked },
    paginationDisplayMode: 'pages',
    enablePagination: false,
    enableRowVirtualization: true,
    mantinePaperProps: { style: { maxHeight: '100%', display: 'flex', flexDirection: 'column' } },
    layoutMode: 'grid',
    defaultColumn: {
      minSize: 20,
      maxSize: 1000,
      size: 180,
    },
    enableDensityToggle: false,
    positionToolbarAlertBanner: 'none',
  });

  return (
    configs.length > 0 ? (
      <MantineReactTable
        table={table}
      />
    ) : (
      <>
        <Space h="xl" />
        <Flex justify="center" align="center">
          <Text>No data available</Text>
        </Flex>
      </>
    )
  );
}
