import { PREFIX } from '../App';
import { useEffect, useState } from 'react';
import ReactMarkdownWrapper from '../components/ReactMarkdownWrapper';

export default function MarkdownController({
  path
}: {
  path: string;
}) {
  const [importedText, setImportedText] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${PREFIX}${path}`)
      .then((response) => response.text())
      .then((text) => setImportedText(text));
  }, [path]);

  if (importedText === null) return null;

  return <>
    <ReactMarkdownWrapper text={importedText} />
  </>;
}
