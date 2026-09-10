import { useCallback, useMemo } from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { PREFIX } from '../utils/Prefix';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { getAssetStatus, useAssetStatus } from '../store/hooks/useAssetStatus';
import { useCurrentIdentifier } from '../routes/utils';
import { useAsyncResource } from '../store/hooks/useAsyncResource';

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
  const assetStatus = getAssetStatus(status);
  useAssetStatus(assetStatus);

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
