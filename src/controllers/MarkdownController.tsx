import { useEffect, useState } from 'react';
import ReactMarkdownWrapper from '../components/ReactMarkdownWrapper';
import { MarkdownComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';

export default function MarkdownController({ currentConfig }: { currentConfig: MarkdownComponent; }) {
  const [importedText, setImportedText] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${PREFIX}${currentConfig.path}`)
      .then((response) => response.text())
      .then((text) => setImportedText(text));
  }, [currentConfig]);

  if (importedText === null) return null;

  return (
    <ReactMarkdownWrapper text={importedText} />
  );
}
