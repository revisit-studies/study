import { useEffect, useState } from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';
import { fetchStylesheet } from '../utils/fetchStylesheet';

const defaultStyle = {
  width: '100%',
};

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const markdownStyle = { ...defaultStyle, ...currentConfig.style };
  const [importedText, setImportedText] = useState<string>('');

  // Fetch external stylesheet if specified
  useEffect(() => {
    if (currentConfig.stylesheetPath) {
      fetchStylesheet(currentConfig.stylesheetPath);
    }
  }, [currentConfig.stylesheetPath]);

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
    ? <div style={markdownStyle}><ReactMarkdownWrapper text={importedText} /></div>
    : <ResourceNotFound path={currentConfig.path} />;
}
