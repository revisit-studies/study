import {
  Burger, Drawer, Checkbox, NativeSelect, Slider, Stack, Text, Box,
} from '@mantine/core';
import { useState } from 'react';
import {
  ClusteringMode, ClusteringVariable, ColorScheme, EncodingType,
} from '../utils/Enums';
import { ConfigProps } from '../utils/Interfaces';

const filesObj = import.meta.glob('/public/matrices/data/*');
const files = Object.keys(filesObj).map((path) => path.replace('/public/matrices/data/', ''));

export default function ControlPanel({
  configProps,
  dataname,
  setDataname,
}: {
  configProps: ConfigProps;
  dataname: string;
  setDataname: React.Dispatch<React.SetStateAction<string>>;
}) {
  const {
    showTooltip,
    encoding,
    colorScheme,
    markContrast,
    nMeans,
    nDevs,
    clusterMode,
    clusterVar,
    setShowTooltip,
    setEncoding,
    setColorScheme,
    setMarkContrast,
    setClusterMode,
    setClusterVar,
    setNMeans,
    setNDevs,
    showConfigurationPanel,
  } = configProps;

  const [opened, setOpened] = useState(false);

  return (
    <Box>
      {!showConfigurationPanel && !opened && (
        <Burger
          opened={opened}
          onClick={() => setOpened((o) => !o)}
          size="lg"
          style={{
            position: 'fixed',
            top: 80,
            left: 500,
          }}
        />
      )}

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="left"
        size={300}
        padding="md"
        withOverlay={false}
        title="Configuration"
      >
        <Stack gap="md">
          <Checkbox
            label="Tooltip"
            checked={showTooltip}
            onChange={(e) => setShowTooltip(e.currentTarget.checked)}
          />

          <NativeSelect
            label="Data file:"
            value={dataname}
            onChange={(e) => setDataname(e.currentTarget.value)}
            data={files}
          />

          <NativeSelect
            label="Encoding:"
            value={encoding}
            onChange={(e) => setEncoding(e.currentTarget.value as EncodingType)}
            data={Object.values(EncodingType)}
          />

          <NativeSelect
            label="Color scheme:"
            value={colorScheme}
            onChange={(e) => setColorScheme(e.currentTarget.value as ColorScheme)}
            data={Object.values(ColorScheme)}
          />

          <Stack gap="xs">
            <Text size="sm">
              Grey Mark contrast:
              {markContrast}
            </Text>
            <Slider min={0} max={100} value={markContrast} onChange={setMarkContrast} />
          </Stack>

          <NativeSelect
            label="Cluster mode:"
            value={clusterMode}
            onChange={(e) => setClusterMode(e.currentTarget.value as ClusteringMode)}
            data={Object.values(ClusteringMode)}
          />

          <NativeSelect
            label="Cluster variable:"
            value={clusterVar}
            onChange={(e) => setClusterVar(e.currentTarget.value as ClusteringVariable)}
            data={Object.values(ClusteringVariable)}
          />

          <Stack gap="xs">
            <Text size="sm">
              Mean Steps:
              {nMeans}
            </Text>
            <Slider min={2} max={5} value={nMeans} onChange={setNMeans} />
          </Stack>

          <Stack gap="xs">
            <Text size="sm">
              Deviation Steps:
              {nDevs}
            </Text>
            <Slider min={2} max={5} value={nDevs} onChange={setNDevs} />
          </Stack>
        </Stack>
      </Drawer>
    </Box>
  );
}
