import { Modal } from '@mantine/core';
import { toggleShowHelpText, useFlagsDispatch, useFlagsSelector } from '../../store/flags';
import ReactMarkdown from 'react-markdown';
import { useAppSelector } from '../../store';
import { useEffect, useState } from 'react';


export default function HelpModal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showHelpText = useFlagsSelector((state: any) => state.showHelpText);
  const config = useAppSelector((state) => state.study.config);

  const flagsDispatch = useFlagsDispatch();

  const [helpText, setHelpText] = useState('');

  useEffect(() => {
    if (!config) return;
    if (!config.uiConfig.helpTextPath) return;

    fetch(config.uiConfig.helpTextPath)
      .then((response) => response.text())
      .then((text) => setHelpText(text));
  }, [config]);

  return (
    <Modal opened={showHelpText} onClose={() => flagsDispatch(toggleShowHelpText())} title="Help">
      <ReactMarkdown>{helpText}</ReactMarkdown>
    </Modal>
  );
}