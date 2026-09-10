import { useMemo } from 'react';
import { Image } from '@mantine/core';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAssetStatus, useAssetLoadStatus } from '../store/hooks/useAssetStatus';
import { useCurrentIdentifier } from '../routes/utils';

export function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const templateData = useTemplateAnswerContext();
  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const url = useMemo(() => {
    if (templatedPath === undefined) return undefined;
    if (templatedPath.startsWith('http')) return templatedPath;
    return `${PREFIX}${templatedPath}`;
  }, [templatedPath]);
  const identifier = useCurrentIdentifier();
  const requestKey = url === undefined ? undefined : `${identifier}:${url}`;
  const { status: assetStatus, onReady, onError } = useAssetLoadStatus(requestKey);

  useAssetStatus(assetStatus);

  if (url === undefined || templatedPath === undefined) {
    return null;
  }

  return assetStatus === 'error'
    ? <ResourceNotFound path={templatedPath} />
    : (
      <Image
        key={requestKey}
        mx="auto"
        src={url}
        onLoad={onReady}
        onError={onError}
      />
    );
}
