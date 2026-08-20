import { Image } from '@mantine/core';
import {
  useEffect, useMemo, useState,
} from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';

export function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const templatedPath = useMemo(
    () => compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true }),
    [currentConfig.path, currentConfig.parameters],
  );

  const url = useMemo(() => {
    if (templatedPath.startsWith('http')) {
      return templatedPath;
    }
    return `${PREFIX}${templatedPath}`;
  }, [templatedPath]);

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);

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
    ? <Image mx="auto" src={url} />
    : <ResourceNotFound path={templatedPath} />;
}
