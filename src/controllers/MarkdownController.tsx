import { useEffect, useState } from 'react';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { PREFIX } from '../utils/Prefix';
import { useFetchStylesheet } from '../utils/fetchStylesheet';
import { useCurrentComponent } from '../routes/utils';

const defaultStyle :React.CSSProperties = {
  width: '100%',
};

export function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const componentId = useCurrentComponent();
  const markdownStyle = { ...defaultStyle, ...currentConfig.style };
  const [importedText, setImportedText] = useState<string>('');

  useFetchStylesheet(currentConfig.stylesheetPath);

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
    ? <div className={currentConfig.type} id={componentId} style={markdownStyle}><ReactMarkdownWrapper text={importedText} /></div>
    : <ResourceNotFound path={currentConfig.path} />;
}
