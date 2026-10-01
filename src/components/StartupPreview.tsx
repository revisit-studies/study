import { Box, Center, Image } from '@mantine/core';
import { useEffect, useState } from 'react';
import { getComponentContainerStyle } from '../utils/componentStyle';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import type { StaticFirstComponentPreview } from '../utils/getStaticFirstComponent';
import { PREFIX } from '../utils/Prefix';
import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';

function getAssetUrl(path: string) {
  return path.startsWith('http') ? path : `${PREFIX}${path}`;
}

/**
 * Displays only the first static stimulus while participant initialization is
 * pending. It intentionally does not mount the participant runtime, responses,
 * navigation, recording, timers, or global input handlers.
 */
export function StartupPreview({ preview }: { preview: StaticFirstComponentPreview }) {
  const [markdown, setMarkdown] = useState('');
  const { component, componentName } = preview;

  useEffect(() => {
    let cancelled = false;
    if (component.type !== 'markdown') {
      setMarkdown('');
      return () => { cancelled = true; };
    }

    getStaticAssetByPath(getAssetUrl(component.path))
      .then((text) => {
        if (!cancelled) setMarkdown(text ?? '');
      })
      .catch(() => {
        if (!cancelled) setMarkdown('');
      });

    return () => { cancelled = true; };
  }, [component]);

  return (
    <Center mih="80vh">
      <Box
        data-testid="startup-preview"
        id={componentName}
        className={`stimulus ${component.type}`}
        style={getComponentContainerStyle(component.type, component.style)}
      >
        {component.type === 'markdown' ? (
          <ReactMarkdownWrapper text={markdown} />
        ) : (
          <Image mx="auto" src={getAssetUrl(component.path)} />
        )}
      </Box>
    </Center>
  );
}
