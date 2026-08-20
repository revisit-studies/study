import {
  useEffect, useMemo, useState,
} from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';
import { compileTemplate } from '../utils/handlebars';

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const [foundAsset, setFoundAsset] = useState(true);
  const [importedText, setImportedText] = useState<string>('');

  const [loading, setLoading] = useState(true);

  const templatedPath = useMemo(
    () => compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true }),
    [currentConfig.path, currentConfig.parameters],
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
    () => compileTemplate(importedText, currentConfig.parameters ?? {}),
    [importedText, currentConfig.parameters],
  );

  return loading || foundAsset
    ? <ReactMarkdownWrapper text={renderedText} />
    : <ResourceNotFound path={templatedPath} />;
}
