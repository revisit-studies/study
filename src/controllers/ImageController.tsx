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
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const url = useMemo(() => {
    if (templatedPath === undefined) {
      return undefined;
    }
    if (templatedPath.startsWith('http')) {
      return templatedPath;
    }
    return `${PREFIX}${templatedPath}`;
  }, [templatedPath]);

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);

  useEffect(() => {
    // While the path is templated inside a dynamic block, url is undefined until the block's
    // current iteration resolves — don't fetch an asset built from the wrong iteration.
    if (url === undefined) {
      return;
    }

    async function fetchImage(assetUrl: string) {
      let asset = await getStaticAssetByPath(assetUrl);
      asset = asset?.includes('File not found') ? undefined : asset;
      setAssetFound(!!asset);
      setLoading(false);
    }

    fetchImage(url);
  }, [url]);

  if (url === undefined || templatedPath === undefined) {
    return null;
  }

  return loading || assetFound
    ? <Image mx="auto" src={url} />
    : <ResourceNotFound path={templatedPath} />;
}
