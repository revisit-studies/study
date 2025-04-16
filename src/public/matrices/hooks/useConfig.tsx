import { useState } from 'react';
import { ChartParams } from '../utils/Interfaces';

export function useConfig(parameters: ChartParams) {
  const [colorScale, setColorScale] = useState<string>(parameters.colorScale ?? 'viridis');
  const [encoding, setEncoding] = useState<string>(parameters.encoding ?? 'simple');
  const [showTooltip, setShowTooltip] = useState<boolean>(parameters.showTooltip ?? false);
  const [isSnr, setIsSnr] = useState<boolean>(parameters.isSnr ?? false);
  const [clusterMode, setClusterMode] = useState<string>(parameters.clusterMode ?? 'none');
  const [clusterVar, setClusterVar] = useState<string>(parameters.clusterVar ?? 'mean');
  const [nMeans, setNMeans] = useState<number>(parameters.nMeans ?? 5);
  const [nDevs, setNDevs] = useState<number>(parameters.nDevs ?? 5);

  return {
    colorScale,
    setColorScale,
    encoding,
    setEncoding,
    showTooltip,
    setShowTooltip,
    isSnr,
    setIsSnr,
    clusterMode,
    setClusterMode,
    clusterVar,
    setClusterVar,
    nMeans,
    setNMeans,
    nDevs,
    setNDevs,
  };
}
