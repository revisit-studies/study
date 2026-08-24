import { Modal } from '@mantine/core';
import { useMemo } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { getStaticAssetByPath } from '../../utils/getStaticAsset';
import { ResourceNotFound } from '../../ResourceNotFound';
import { PREFIX } from '../../utils/Prefix';
import { useCurrentComponent } from '../../routes/utils';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { compileTemplate } from '../../utils/handlebars';
import { useTemplateAnswerContext } from '../../store/hooks/useTemplateAnswerContext';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { useAsyncResource } from '../../store/hooks/useAsyncResource';

async function loadHelpText(path: string) {
  if (!path) return undefined;
  return getStaticAssetByPath(`${PREFIX}${path}`);
}

export function HelpModal() {
  const showHelpText = useStoreSelector((state) => state.showHelpText);
  const config = useStoreSelector((state) => state.config);
  const status = useStoredAnswer();

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const component = useCurrentComponent();

  const componentConfig = useMemo(() => studyComponentToIndividualComponent(config.components[component] || {}, config), [component, config]);

  const helpTextPath = useMemo(() => componentConfig.helpTextPath ?? config.uiConfig.helpTextPath, [componentConfig.helpTextPath, config.uiConfig.helpTextPath]);

  const templateData = useTemplateAnswerContext();

  const helpTextParameters = useMemo(
    () => status?.parameters ?? componentConfig.parameters ?? {},
    [status?.parameters, componentConfig.parameters],
  );

  // helpTextPath can itself be templated (e.g. `help-{{condition}}.md`), so it must be resolved
  // with the same parameters/answer context before it's used to fetch the asset. While the
  // dynamic component this modal is showing help for hasn't resolved yet, templateData is
  // undefined and the path must not be compiled or fetched — it would resolve against the wrong
  // iteration.
  const resolvedHelpTextPath = useMemo(
    () => (helpTextPath && templateData ? compileTemplate(helpTextPath, helpTextParameters, { noEscape: true, data: templateData }) : undefined),
    [helpTextPath, helpTextParameters, templateData],
  );
  const requestedHelpTextPath = templateData === undefined ? undefined : resolvedHelpTextPath ?? '';
  const { status: resourceStatus, value: helpText = '' } = useAsyncResource(requestedHelpTextPath, loadHelpText);

  const templatedHelpText = useMemo(
    () => (templateData ? compileTemplate(helpText, helpTextParameters, { data: templateData }) : ''),
    [helpText, helpTextParameters, templateData],
  );

  return (
    <Modal className="helpModal" size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      {resourceStatus === 'loading' || resourceStatus === 'unresolved'
        ? <ReactMarkdownWrapper text="" />
        : resourceStatus === 'success'
          ? <ReactMarkdownWrapper text={templatedHelpText} />
          : <ResourceNotFound path={resolvedHelpTextPath} />}
    </Modal>
  );
}
