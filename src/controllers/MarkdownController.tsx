import { useCallback, useEffect, useMemo } from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAsyncResource } from '../store/hooks/useAsyncResource';
import { useCurrentIdentifier } from '../routes/utils';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const templateData = useTemplateAnswerContext();

  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const identifier = useCurrentIdentifier();
  const requestKey = templatedPath === undefined ? undefined : `${identifier}:${templatedPath}`;
  const loadMarkdown = useCallback(async () => {
    if (templatedPath === undefined) return undefined;
    return getStaticAssetByPath(templatedPath.startsWith('http') ? templatedPath : `${PREFIX}${templatedPath}`);
  }, [templatedPath]);
  const { status, value: importedText = '' } = useAsyncResource(requestKey, loadMarkdown);
  const assetStatus = status === 'success' ? 'ready' : status === 'missing' || status === 'error' ? 'error' : 'loading';
  const storeDispatch = useStoreDispatch();
  const { setAssetStatus } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  useEffect(() => {
    if (isAnalysis) return undefined;
    storeDispatch(setAssetStatus({ identifier, status: assetStatus }));
    return () => { storeDispatch(setAssetStatus({ identifier, status: 'loading' })); };
  }, [assetStatus, identifier, isAnalysis, setAssetStatus, storeDispatch]);

  const renderedText = useMemo(
    () => (templateData ? compileTemplate(importedText, currentConfig.parameters ?? {}, { data: templateData }) : ''),
    [importedText, currentConfig.parameters, templateData],
  );

  if (templatedPath === undefined) {
    return null;
  }

  if (status === 'loading') {
    return <ReactMarkdownWrapper text="" />;
  }

  return status === 'success'
    ? <ReactMarkdownWrapper text={renderedText} />
    : <ResourceNotFound path={templatedPath} />;
}
