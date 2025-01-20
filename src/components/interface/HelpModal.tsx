import { Modal } from '@mantine/core';
import { useEffect, useState } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { getStaticAssetByPath } from '../../utils/getStaticAsset';
import { ResourceNotFound } from '../../ResourceNotFound';

export function HelpModal() {
  const showHelpText = useStoreSelector((state) => state.showHelpText);
  const config = useStoreSelector((state) => state.config);

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const [helpText, setHelpText] = useState('');

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchText() {
      if (!config.uiConfig.helpTextPath) {
        setLoading(false);
        return;
      }
      const asset = await getStaticAssetByPath(config.uiConfig.helpTextPath);
      if (asset !== undefined) {
        setHelpText(asset);
      }
      setLoading(false);
    }

    fetchText();
  }, [config.uiConfig.helpTextPath]);

  return (
    <Modal size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      {loading || helpText
        ? <ReactMarkdownWrapper text={helpText} />
        : <ResourceNotFound path={config.uiConfig.helpTextPath} />}
    </Modal>
  );
}
