import { Modal } from '@mantine/core';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useUntrrackedActions } from '../../store/store';
import { useEffect, useState } from 'react';
import { PREFIX } from '.././GlobalConfigParser';


export default function HelpModal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showHelpText = useStoreSelector((state: any) => state.unTrrackedSlice.showHelpText);
  const config = useStoreSelector((state) => state.unTrrackedSlice.config);

  const storeDispatch = useStoreDispatch();
  const unTrrackedActions = useUntrrackedActions();
  const { toggleShowHelpText } = unTrrackedActions;

  const [helpText, setHelpText] = useState('');
  useEffect(() => {
    if (!config) return;
    if (!config.uiConfig.helpTextPath) return;

    fetch(`${PREFIX}${config.uiConfig.helpTextPath}`)
      .then((response) => response.text())
      .then((text) => setHelpText(text));
  }, [config]);

  return (
    <Modal size={'auto'} opened={showHelpText} onClose={() => storeDispatch(toggleShowHelpText())} title="Help">
      <ReactMarkdownWrapper text={helpText} />
    </Modal>
  );
}