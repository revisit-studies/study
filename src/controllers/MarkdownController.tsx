import { useMemo } from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAsyncResource } from '../store/hooks/useAsyncResource';

async function loadMarkdown(path: string) {
  return getStaticAssetByPath(`${PREFIX}${path}`);
}

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const templateData = useTemplateAnswerContext();

  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const { status, value: importedText = '' } = useAsyncResource(templatedPath, loadMarkdown);

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
