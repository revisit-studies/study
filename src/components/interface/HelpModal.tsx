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
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';

export function HelpModal() {
  const showHelpText = useStoreSelector((state) => state.showHelpText);
  const config = useStoreSelector((state) => state.config);
  const status = useStoredAnswer();

  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText } = useStoreActions();

  const [foundAsset, setFoundAsset] = useState(true);
  const [helpText, setHelpText] = useState('');
  const [loadedHelpTextPath, setLoadedHelpTextPath] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
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
  // undefined and the path must not be compiled or fetched — it would resolve against the
  // wrong iteration.
  const resolvedHelpTextPath = useMemo(
    () => (helpTextPath && templateData ? compileTemplate(helpTextPath, helpTextParameters, { noEscape: true, data: templateData }) : undefined),
    [helpTextPath, helpTextParameters, templateData],
  );
  const templateReady = templateData !== undefined;
  const requestedHelpTextPath = resolvedHelpTextPath ?? '';

  const templatedHelpText = useMemo(
    () => (templateData ? compileTemplate(helpText, helpTextParameters, { data: templateData }) : ''),
    [helpText, helpTextParameters, templateData],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFoundAsset(false);
    setHelpText('');
    setLoadedHelpTextPath(null);

    if (!templateReady) {
      return () => {
        cancelled = true;
      };
    }

    async function fetchText() {
      if (!resolvedHelpTextPath) {
        if (cancelled) return;
        setFoundAsset(false);
        setLoadedHelpTextPath('');
        setLoading(false);
        return;
      }
      try {
        const asset = await getStaticAssetByPath(`${PREFIX}${resolvedHelpTextPath}`);
        if (cancelled) return;
        setHelpText(asset ?? '');
        setFoundAsset(asset !== undefined);
        setLoadedHelpTextPath(resolvedHelpTextPath);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setFoundAsset(false);
        setLoadedHelpTextPath(resolvedHelpTextPath);
        setLoading(false);
      }
    }

    fetchText();
    return () => {
      cancelled = true;
    };
  }, [resolvedHelpTextPath, templateReady]);

  const currentPathLoaded = templateReady && loadedHelpTextPath === requestedHelpTextPath;

  return (
    <Modal className="helpModal" size="70%" opened={showHelpText} withCloseButton={false} onClose={() => storeDispatch(toggleShowHelpText())}>
      {loading || !currentPathLoaded
        ? <ReactMarkdownWrapper text="" />
        : foundAsset
          ? <ReactMarkdownWrapper text={templatedHelpText} />
          : <ResourceNotFound path={resolvedHelpTextPath} />}
    </Modal>
  );
}
