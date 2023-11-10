import { Modal } from '@mantine/core';
import { toggleShowHelpText, useFlagsDispatch, useFlagsSelector } from '../../store/flags';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useAppSelector } from '../../store/store';
import { useEffect, useState } from 'react';
import { PREFIX } from '.././GlobalConfigParser';


export default function HelpModal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showHelpText = useFlagsSelector((state: any) => state.showHelpText);
  const config = useAppSelector((state) => state.unTrrackedSlice.config);

  const flagsDispatch = useFlagsDispatch();

  const [helpText, setHelpText] = useState('');
  useEffect(() => {
    if (!config) return;
    if (!config.uiConfig.helpTextPath) return;

    fetch(`${PREFIX}${config.uiConfig.helpTextPath}`)
      .then((response) => response.text())
      .then((text) => setHelpText(text));
  }, [config]);

  return (
    <Modal size={'auto'} opened={showHelpText} onClose={() => flagsDispatch(toggleShowHelpText())} title="Help">
      <ReactMarkdownWrapper text={helpText} />
    </Modal>
  );
}