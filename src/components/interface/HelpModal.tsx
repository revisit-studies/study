import { Modal } from '@mantine/core';
import { useEffect, useState } from 'react';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { getStaticAssetByPath } from '../../utils/getStaticAsset';
import ResourceNotFound from '../../ResourceNotFound';

export default function HelpModal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { showHelpText, config } = useStoreSelector((state: any) => state);

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const [helpText, setHelpText] = useState('');

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchImage() {
      const asset = await getStaticAssetByPath(config.uiConfig.helpTextPath);
      if (asset !== undefined) {
        setHelpText(asset);
      }
      setLoading(false);
    }

    fetchImage();
  }, [config.uiConfig.helpTextPath]);

  return (
    <Modal size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      {loading || helpText
        ? <ReactMarkdownWrapper text={helpText} />
        : <ResourceNotFound path={config.uiConfig.helpTextPath} />}
    </Modal>
  );
}
