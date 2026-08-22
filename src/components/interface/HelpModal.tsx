import { Modal } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { getStaticAssetByPath } from '../../utils/getStaticAsset';
import { ResourceNotFound } from '../../ResourceNotFound';
import { PREFIX } from '../../utils/Prefix';
import { useCurrentComponent } from '../../routes/utils';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { compileTemplate } from '../../utils/handlebars';
import { useTemplateAnswerContext } from '../../store/hooks/useTemplateAnswerContext';

export function HelpModal() {
  const showHelpText = useStoreSelector((state) => state.showHelpText);
  const config = useStoreSelector((state) => state.config);

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const [foundAsset, setFoundAsset] = useState(true);
  const [helpText, setHelpText] = useState('');

  const [loading, setLoading] = useState(true);
  const component = useCurrentComponent();

  const componentConfig = useMemo(() => studyComponentToIndividualComponent(config.components[component] || {}, config), [component, config]);

  const helpTextPath = useMemo(() => componentConfig.helpTextPath ?? config.uiConfig.helpTextPath, [componentConfig.helpTextPath, config.uiConfig.helpTextPath]);

  const templateData = useTemplateAnswerContext();

  // helpTextPath can itself be templated (e.g. `help-{{condition}}.md`), so it must be resolved
  // with the same parameters/answer context before it's used to fetch the asset.
  const resolvedHelpTextPath = useMemo(
    () => (helpTextPath ? compileTemplate(helpTextPath, componentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : helpTextPath),
    [helpTextPath, componentConfig.parameters, templateData],
  );

  const templatedHelpText = useMemo(
    () => compileTemplate(helpText, componentConfig.parameters ?? {}, { data: templateData }),
    [helpText, componentConfig.parameters, templateData],
  );

  useEffect(() => {
    async function fetchText() {
      if (!resolvedHelpTextPath) {
        setFoundAsset(false);
        setLoading(false);
        return;
      }
      const asset = await getStaticAssetByPath(`${PREFIX}${resolvedHelpTextPath}`);
      if (asset !== undefined) {
        setHelpText(asset);
      } else {
        setFoundAsset(false);
      }
      setLoading(false);
    }

    fetchText();
  }, [resolvedHelpTextPath]);

  return (
    <Modal className="helpModal" size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      {loading || foundAsset
        ? <ReactMarkdownWrapper text={templatedHelpText} />
        : <ResourceNotFound path={resolvedHelpTextPath} />}
    </Modal>
  );
}
