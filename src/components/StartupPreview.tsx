import { Box, Center, Image } from '@mantine/core';
import { getComponentContainerStyle } from '../utils/componentStyle';
import { getStaticAssetUrl, type StaticFirstComponentPreview } from '../utils/getStaticFirstComponent';
import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';

/**
 * Displays only the first static stimulus while participant initialization is
 * pending. It intentionally does not mount the participant runtime, responses,
 * navigation, recording, timers, or global input handlers. Markdown bodies are
 * loaded and checked to be free of template syntax before the preview is chosen.
 */
export function StartupPreview({ preview }: { preview: StaticFirstComponentPreview }) {
  const { component, componentName, markdown } = preview;

  return (
    <Center mih="80vh">
      <Box
        data-testid="startup-preview"
        id={componentName}
        className={`stimulus ${component.type}`}
        style={getComponentContainerStyle(component.type, component.style)}
      >
        {component.type === 'markdown' ? (
          <ReactMarkdownWrapper text={markdown ?? ''} />
        ) : (
          <Image mx="auto" src={getStaticAssetUrl(component.path)} />
        )}
      </Box>
    </Center>
  );
}
