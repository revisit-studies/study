import { useEffect, useState } from 'react';
import { Vega } from 'react-vega';
import { VegaComponent } from '../parser/types';
// import { PREFIX } from '../utils/Prefix';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import ResourceNotFound from '../ResourceNotFound';

// const defaultStyle = {
//   maxWidth: '100%',
// };

function VegaController({ currentConfig }: { currentConfig: VegaComponent; }) {
  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vegaConfig, setVegaConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchVega() {
      const asset = await getJsonAssetByPath(currentConfig.path);
      setAssetFound(!!asset);
      if (asset !== undefined) {
        setVegaConfig(asset);
      }
      setLoading(false);
    }

    fetchVega();
  }, [currentConfig]);

  return loading || assetFound ? (
    <Vega spec={vegaConfig.spec} data={vegaConfig.data} />
  )
    : <ResourceNotFound path={currentConfig.path} />;
}

export default VegaController;
