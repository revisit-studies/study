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
    () => compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  useEffect(() => {
    async function fetchImage() {
      const asset = await getStaticAssetByPath(`${PREFIX}${templatedPath}`);
      if (asset !== undefined) {
        setImportedText(asset);
      } else {
        setFoundAsset(false);
      }
      setLoading(false);
    }

    fetchImage();
  }, [templatedPath]);

  const renderedText = useMemo(
    () => compileTemplate(importedText, currentConfig.parameters ?? {}, { data: templateData }),
    [importedText, currentConfig.parameters, templateData],
  );

  return loading || foundAsset
    ? <ReactMarkdownWrapper text={renderedText} />
    : <ResourceNotFound path={templatedPath} />;
}
