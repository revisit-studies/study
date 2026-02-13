/* eslint-disable react/no-unstable-nested-components */
import {
  Button, Flex, Space, Text, Tooltip, Group, Modal, ActionIcon, Loader, Stack, Paper, Box,
} from '@mantine/core';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell as MrtCell, MRT_ColumnDef as MrtColumnDef, MRT_RowSelectionState as MrtRowSelectionState, useMantineReactTable,
} from 'mantine-react-table';
import {
  IconInfoCircle, IconDownload, IconEye, IconArrowsLeftRight, IconCopy,
} from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { downloadConfigFile, downloadConfigFilesZip } from '../../../utils/handleDownloadFiles';
import { ConfigInfo, buildConfigRows } from './utils';
import { ConfigDiffModal } from './ConfigDiffModal';

export function ConfigView({
  visibleParticipants,
}: {
  visibleParticipants: ParticipantData[];
}) {
  const { studyId } = useParams();
  const [checked, setChecked] = useState<MrtRowSelectionState>({});
  const { storageEngine } = useStorageEngine();
  const [configs, setConfigs] = useState<ConfigInfo[]>([]);
  const [viewConfig, setViewConfig] = useState<string | null>(null);
  const [modalViewConfigOpened, setModalViewConfigOpened] = useState(false);
  const [modalCompareConfigOpened, setModalCompareConfigOpened] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storageEngine || !studyId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    const fetchConfigs = async () => {
      try {
        const allConfigHashes = [...new Set(visibleParticipants.map((participant) => participant.participantConfigHash))];
        const fetchedConfigs = await storageEngine.getAllConfigsFromHash(allConfigHashes, studyId);
        const rows = buildConfigRows(fetchedConfigs, visibleParticipants);
        setConfigs(rows);
      } catch (error) {
        console.error('Error fetching configs:', error);
        setConfigs([]);
      }
      setLoading(false);
    };

    fetchConfigs();
  }, [visibleParticipants, storageEngine, studyId]);

  const handleViewConfig = useCallback((hash: string) => {
    const selectedConfig = configs.find((config) => config.hash === hash) || null;
    setViewConfig(selectedConfig ? JSON.stringify(selectedConfig.config, null, 2) : null);
  }, [configs]);

  const handleDownloadConfig = useCallback(async (hash: string) => {
    const selectedConfig = configs.find((config) => config.hash === hash);
    if (!selectedConfig || !studyId) {
      return;
    }

    await downloadConfigFile({
      studyId,
      hash,
      config: selectedConfig.config,
    });
  }, [configs, studyId]);

  const handleDownloadConfigs = useCallback(async () => {
    const selectedConfigHashes = Object.keys(checked).filter((key) => checked[key]);
    if (!studyId || selectedConfigHashes.length === 0) {
      return;
    }

    await downloadConfigFilesZip({
      studyId,
      configs,
      hashes: selectedConfigHashes,
    });
  }, [configs, checked, studyId]);

  const handleCompareConfigs = useCallback(() => {
    setModalCompareConfigOpened(true);
  }, []);

  const [copied, setCopied] = useState<string | null>(null);

  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(hash);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const columns = useMemo<MrtColumnDef<ConfigInfo>[]>(() => [
    {
      id: 'configIndex',
      header: '#',
      size: 30,
      Cell: ({ row }) => row.index + 1,
    },
    {
      accessorKey: 'version',
      header: 'Version',
      size: 70,
      Cell: ({ row }: { row: { original: ConfigInfo } }) => (
        <Text>{row.original.version}</Text>
      ),
    },
    {
      accessorKey: 'hash',
      header: 'Hash',
      size: 70,
      Cell: ({ row }: { row: { original: ConfigInfo } }) => (
        <Flex align="center" gap="xs">
          <Text>
            {row.original.hash.slice(0, 6)}
            ...
          </Text>
          <Tooltip label={row.original.hash}>
            <IconInfoCircle size={16} color="gray" />
          </Tooltip>
          <Tooltip label={copied === row.original.hash ? 'Copied' : 'Copy hash'}>
            <ActionIcon
              variant="subtle"
              onClick={() => handleCopyHash(row.original.hash)}
              color="gray"
            >
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
        </Flex>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Date',
      size: 70,
    },
    {
      accessorKey: 'timeFrame',
      header: 'Time Frame',
      size: 150,
    },
    {
      accessorKey: 'participantCount',
      header: 'Participants',
      size: 70,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      accessorFn: (row: ConfigInfo) => row.hash,
      Cell: ({ cell }: { cell: MrtCell<ConfigInfo, string> }) => (
        <Flex gap="sm">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEye size={14} />}
            onClick={() => { setModalViewConfigOpened(true); handleViewConfig(cell.getValue()); }}
          >
            View
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconDownload size={14} />}
            onClick={() => handleDownloadConfig(cell.getValue())}
          >
            Download
          </Button>
        </Flex>
      ),
    },
  ], [handleDownloadConfig, handleViewConfig, handleCopyHash, copied]);

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
    renderTopToolbarCustomActions: () => {
      const selectedConfigHashes = Object.keys(checked).filter((key) => checked[key]);
      return (
        <Flex>
          {selectedConfigHashes.length > 0 && (
            <Group>
              <Button onClick={handleDownloadConfigs}>
                Download Configs (
                {selectedConfigHashes.length}
                )
              </Button>
              {selectedConfigHashes.length === 2 && (
                <Button
                  onClick={handleCompareConfigs}
                  leftSection={<IconArrowsLeftRight size={16} />}
                  variant="light"
                >
                  Compare
                </Button>
              )}
            </Group>
          )}
        </Flex>
      );
    },
  });

  return loading ? (
    <Stack align="center" p="md">
      <Loader size="sm" />
      <Text size="sm" c="dimmed">Loading config data...</Text>
    </Stack>
  ) : (
    configs.length > 0 ? (
      <>
        <MantineReactTable
          table={table}
        />
        <Modal
          opened={modalViewConfigOpened}
          onClose={() => setModalViewConfigOpened(false)}
          title="Config"
          size="95%"
        >
          {viewConfig ? (
            <Paper radius="sm" style={{ overflow: 'hidden' }}>
              <Box style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                {viewConfig.split('\n').map((line, idx) => (
                  <Box
                    key={idx}
                    style={{
                      backgroundColor: 'transparent',
                      padding: '4px 12px',
                      borderLeft: '3px solid transparent',
                      whiteSpace: 'pre',
                      minHeight: '24px',
                    }}
                  >
                    <Text component="span" ff="monospace" size="sm">
                      {'  '}
                      {line}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Paper>
          ) : null}
        </Modal>
        <Modal
          opened={modalCompareConfigOpened}
          onClose={() => setModalCompareConfigOpened(false)}
          title="Compare Configs"
          size="95%"
        >
          <ConfigDiffModal configs={
            Object.keys(checked).filter((key) => checked[key])
              .map((hash) => configs.find((c) => c.hash === hash))
              .filter((c): c is ConfigInfo => c !== undefined)
          }
          />
        </Modal>
      </>
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
