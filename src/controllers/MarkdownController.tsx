import {
  useEffect, useMemo, useState,
} from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const [foundAsset, setFoundAsset] = useState(true);
  const [importedText, setImportedText] = useState<string>('');

  const [loading, setLoading] = useState(true);

  const templateData = useTemplateAnswerContext();

  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  useEffect(() => {
    // While the path is templated inside a dynamic block, templatedPath is undefined until the
    // block's current iteration resolves — don't fetch an asset built from the wrong iteration.
    if (templatedPath === undefined) {
      return;
    }

    async function fetchImage(path: string) {
      const asset = await getStaticAssetByPath(`${PREFIX}${path}`);
      if (asset !== undefined) {
        setImportedText(asset);
      } else {
        setFoundAsset(false);
      }
      setLoading(false);
    }

    fetchImage(templatedPath);
  }, [templatedPath]);

  const renderedText = useMemo(
    () => (templateData ? compileTemplate(importedText, currentConfig.parameters ?? {}, { data: templateData }) : ''),
    [importedText, currentConfig.parameters, templateData],
  );

  if (templatedPath === undefined) {
    return null;
  }

  return loading || foundAsset
    ? <ReactMarkdownWrapper text={renderedText} />
    : <ResourceNotFound path={templatedPath} />;
}
