import { Modal } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { getStaticAssetByPath } from '../../utils/getStaticAsset';
import { ResourceNotFound } from '../../ResourceNotFound';
import { PREFIX } from '../../utils/Prefix';
import { useCurrentComponent } from '../../routes/utils';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';

export function HelpModal() {
  const showHelpText = useStoreSelector((state) => state.showHelpText);
  const config = useStoreSelector((state) => state.config);

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const [helpText, setHelpText] = useState('');

  const [loading, setLoading] = useState(true);
  const component = useCurrentComponent();

  const componentConfig = useMemo(() => studyComponentToIndividualComponent(config.components[component] || {}, config), [component, config]);

  const helpTextPath = useMemo(() => componentConfig.helpTextPath ?? config.uiConfig.helpTextPath, [componentConfig.helpTextPath, config.uiConfig.helpTextPath]);

  useEffect(() => {
    async function fetchText() {
      if (!helpTextPath) {
        setLoading(false);
        return;
      }
      const asset = await getStaticAssetByPath(`${PREFIX}${helpTextPath}`);
      if (asset !== undefined) {
        setHelpText(asset);
      }
      setLoading(false);
    }

    fetchText();
  }, [helpTextPath]);

  return (
    <Modal className="helpModal" size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      {loading || helpText
        ? <ReactMarkdownWrapper text={helpText} />
        : <ResourceNotFound path={config.uiConfig.helpTextPath} />}
    </Modal>
  );
}
