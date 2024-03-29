import { Modal } from '@mantine/core';
import { useEffect, useState } from 'react';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { PREFIX } from '../../utils/Prefix';

export default function HelpModal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { showHelpText, config } = useStoreSelector((state: any) => state);

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const [helpText, setHelpText] = useState('');
  useEffect(() => {
    if (!config) return;
    if (!config.uiConfig.helpTextPath) return;

    fetch(`${PREFIX}${config.uiConfig.helpTextPath}`)
      .then((response) => response.text())
      .then((text) => setHelpText(text));
  }, [config]);

  return (
    <Modal size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      <ReactMarkdownWrapper text={helpText} />
    </Modal>
  );
}
