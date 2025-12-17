/* eslint-disable react/no-unstable-nested-components */
import {
  Button, Flex, Modal, Space, Text, Tooltip,
} from '@mantine/core';
import { IconInfoCircle, IconDownload, IconEye } from '@tabler/icons-react';
import {
  JSX, useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router';
import {
  MantineReactTable, MRT_Cell as MrtCell, MRT_ColumnDef as MrtColumnDef, MRT_RowSelectionState as MrtRowSelectionState, useMantineReactTable,
} from 'mantine-react-table';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { defaultStyle } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { downloadConfigFile, downloadConfigFilesZip } from '../../../utils/handleDownloadFiles';

interface ConfigInfo {
  version: string;
  date: string;
  timeFrame: string;
  hash: string;
  participantCount: number;
  config: StudyConfig;
}

function formatDate(date: Date): string | JSX.Element {
  if (date.valueOf() === 0 || Number.isNaN(date.valueOf())) {
    return <Text size="sm" c="dimmed">None</Text>;
  }

  return date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
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
  const [viewConfig, setViewConfig] = useState<string | null>(null);
  const [modalViewConfigOpened, setModalViewConfigOpened] = useState(false);
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

      const rows = Object.entries(fetchedConfigs).map(([hash, config]) => {
        const filteredParticipants = visibleParticipants.filter((participant) => participant.participantConfigHash === hash);
        const storedAnswers = filteredParticipants.flatMap((p) => Object.values(p.answers));

        const startTime = storedAnswers.map((answer) => answer.startTime).filter((t): t is number => t !== undefined && t > 0);
        const endTime = storedAnswers.map((answer) => answer.endTime).filter((t): t is number => t !== undefined && t > 0);

        const earliestStartTime = startTime.length > 0 ? Math.min(...startTime.values()) : null;
        const latestEndTime = endTime.length > 0 ? Math.max(...endTime.values()) : null;

        const formatTimeFrame = (timestamp: number) => {
          const formatted = formatDate(new Date(timestamp));
          return typeof formatted === 'string' ? formatted : 'N/A';
        };

        const getTimeFrame = (): string => {
          if (earliestStartTime && latestEndTime) {
            return `${formatTimeFrame(earliestStartTime)} - ${formatTimeFrame(latestEndTime)}`;
          }
          if (earliestStartTime) {
            return formatTimeFrame(earliestStartTime);
          }
          return 'N/A';
        };

        return {
          version: config.studyMetadata?.version || '',
          date: config.studyMetadata?.date || '',
          timeFrame: getTimeFrame(),
          hash,
          participantCount: filteredParticipants.length,
          config,
        };
      });

      setConfigs(rows);
    };

    fetchConfigs();
  }, [visibleParticipants, storageEngine, studyId]);

  const selectedConfigs = useMemo(
    () => Object.keys(checked).filter((key) => checked[key]),
    [checked],
  );
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
    if (!studyId || selectedConfigs.length === 0) {
      return;
    }

    await downloadConfigFilesZip({
      studyId,
      configs,
      hashes: selectedConfigs,
    });
  }, [configs, selectedConfigs, studyId]);

  const handleViewConfig = useCallback((hash: string) => {
    const selectedConfig = configs.find((config) => config.hash === hash) || null;
    setViewConfig(selectedConfig ? JSON.stringify(selectedConfig.config, null, 2) : null);
  }, [configs]);

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
        <Flex align="center" gap="xs">
          <Text>{row.original.version}</Text>
          <Tooltip label={row.original.hash}>
            <IconInfoCircle size={16} />
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
  ], [handleDownloadConfig, handleViewConfig]);

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
    renderTopToolbarCustomActions: () => (
      selectedConfigs.length > 0 ? (
        <Button onClick={handleDownloadConfigs}>
          Download Configs (
          {selectedConfigs.length}
          )
        </Button>
      ) : null
    ),
  });

  return (
    <>
      {configs.length > 0 ? (
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
      )}
      <Modal
        opened={modalViewConfigOpened}
        onClose={() => setModalViewConfigOpened(false)}
        title="Config Preview"
        size="70%"
      >
        {viewConfig ? (
          <SyntaxHighlighter
            language="json"
            style={defaultStyle}
          >
            {viewConfig}
          </SyntaxHighlighter>
        ) : null}
      </Modal>
    </>
  );
}
