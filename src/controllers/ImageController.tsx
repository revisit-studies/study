import { Image } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';

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

  const identifier = useCurrentIdentifier();
  const requestKey = url === undefined ? undefined : `${identifier}:${url}`;
  const [imageResult, setImageResult] = useState<{ key?: string; status: 'ready' | 'error' }>();
  useEffect(() => {
    setImageResult(undefined);
  }, [requestKey]);
  const assetStatus = imageResult && imageResult.key === requestKey ? imageResult.status : 'loading';

  const storeDispatch = useStoreDispatch();
  const { setAssetStatus } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  useEffect(() => {
    if (isAnalysis) return undefined;
    storeDispatch(setAssetStatus({ identifier, status: assetStatus }));
    return () => { storeDispatch(setAssetStatus({ identifier, status: 'loading' })); };
  }, [assetStatus, identifier, isAnalysis, setAssetStatus, storeDispatch]);

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
        onLoad={() => setImageResult({ key: requestKey, status: 'ready' })}
        onError={() => setImageResult({ key: requestKey, status: 'error' })}
      />
    );
}
