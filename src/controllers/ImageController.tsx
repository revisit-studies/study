import { Image } from '@mantine/core';
import {
  useEffect, useMemo, useState,
} from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { useFetchStylesheet } from '../utils/fetchStylesheet';

const defaultStyle: React.CSSProperties = {
  maxWidth: '100%',
};

export function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const imageStyle = { ...defaultStyle, ...currentConfig.style };

  const url = useMemo(() => {
    if (currentConfig.path.startsWith('http')) {
      return currentConfig.path;
    }
    return `${PREFIX}${currentConfig.path}`;
  }, [currentConfig.path]);

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);

  useFetchStylesheet(currentConfig.stylesheetPath);

  useEffect(() => {
    async function fetchImage() {
      let asset = await getStaticAssetByPath(url);
      asset = asset?.includes('File not found') ? undefined : asset;
      setAssetFound(!!asset);
      setLoading(false);
    }

    fetchImage();
  }, [url]);

  return loading || assetFound
    ? <Image className={currentConfig.type} style={imageStyle} mx="auto" src={url} />
    : <ResourceNotFound path={currentConfig.path} />;
}
