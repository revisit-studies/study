import { useEffect, useState } from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const [importedText, setImportedText] = useState<string>('');

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchImage() {
      const asset = await getStaticAssetByPath(`${PREFIX}${currentConfig.path}`);
      if (asset !== undefined) {
        setImportedText(asset);
      }
      setLoading(false);
    }

    fetchImage();
  }, [currentConfig.path]);

  return loading || importedText
    ? <ReactMarkdownWrapper text={importedText} />
    : <ResourceNotFound path={currentConfig.path} />;
}
