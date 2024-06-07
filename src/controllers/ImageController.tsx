import { Image } from '@mantine/core';
import { useEffect, useState } from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import ResourceNotFound from '../ResourceNotFound';

const defaultStyle = {
  maxWidth: '100%',
};

function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const imageStyle = { ...defaultStyle, ...currentConfig.style };

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);
  useEffect(() => {
    async function fetchImage() {
      const asset = await getStaticAssetByPath(currentConfig.path);
      setAssetFound(!!asset);
      setLoading(false);
    }

    fetchImage();
  }, [currentConfig]);

  return loading || assetFound ? (
    <Image mx="auto" src={`${PREFIX}${currentConfig.path}`} style={imageStyle} />
  )
    : <ResourceNotFound path={currentConfig.path} />;
}

export default ImageController;
