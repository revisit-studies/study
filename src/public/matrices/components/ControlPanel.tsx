import {
  Checkbox, NativeSelect, Slider, Stack, Text,
} from '@mantine/core';
import {
  ClusteringMode,
  ClusteringVariable,
  ColorScheme,
  EncodingType,
  MarkColor,
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
    markColor,
    nMeans,
    nDevs,
    clusterMode,
    clusterVar,
    setShowTooltip,
    setEncoding,
    setColorScheme,
    setMarkColor,
    setClusterMode,
    setClusterVar,
    setNMeans,
    setNDevs,
  } = configProps;

  return (
    <Stack gap="2vh">
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
        onChange={(event) => setEncoding(event.currentTarget.value as EncodingType)}
        data={Object.values(EncodingType)}
      />

      <NativeSelect
        label="Color scale:"
        value={colorScheme}
        onChange={(event) => setColorScheme(event.currentTarget.value as ColorScheme)}
        data={Object.values(ColorScheme)}
      />

      <NativeSelect
        label="Mark Color:"
        value={markColor}
        onChange={(event) => setMarkColor(event.currentTarget.value as MarkColor)}
        data={Object.values(MarkColor)}
      />

      <NativeSelect
        label="Cluster mode:"
        value={clusterMode}
        onChange={(event) => setClusterMode(event.currentTarget.value as ClusteringMode)}
        data={Object.values(ClusteringMode)}
      />

      <NativeSelect
        label="ClusterVar:"
        value={clusterVar}
        onChange={(event) => setClusterVar(event.currentTarget.value as ClusteringVariable)}
        data={Object.values(ClusteringVariable)}
      />

      <Stack gap="0.2vh">
        <Text size="sm">
          Mean Steps:
          {nMeans}
        </Text>
        <Slider min={2} max={5} value={nMeans} onChange={setNMeans} />
      </Stack>

      <Stack gap="0.2vh">
        <Text size="sm">
          Deviation Steps:
          {nDevs}
        </Text>
        <Slider min={2} max={5} value={nDevs} onChange={setNDevs} />
      </Stack>
    </Stack>
  );
}
