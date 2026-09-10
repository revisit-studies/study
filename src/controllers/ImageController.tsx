import { Image } from '@mantine/core';
import { useMemo } from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAsyncResource } from '../store/hooks/useAsyncResource';

async function loadImage(url: string) {
  let asset = await getStaticAssetByPath(url);
  asset = !asset || asset.includes('File not found') ? undefined : asset;
  return asset;
}

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

  const { status } = useAsyncResource(url, loadImage);

  if (url === undefined || templatedPath === undefined) {
    return null;
  }

  return status === 'loading'
    ? <Image mx="auto" src={url} />
    : status === 'success'
      ? <Image mx="auto" src={url} />
      : <ResourceNotFound path={templatedPath} />;
}
