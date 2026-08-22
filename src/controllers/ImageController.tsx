import { Image } from '@mantine/core';
import {
  useEffect, useMemo, useState,
} from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';

export function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const templateData = useTemplateAnswerContext();

  const templatedPath = useMemo(
    () => compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }),
    [currentConfig.path, currentConfig.parameters, templateData],
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
