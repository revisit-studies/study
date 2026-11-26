import type { CSSProperties } from 'react';
import type { IndividualComponent, Styles } from '../parser/types';

export function getComponentContainerStyle(componentType: IndividualComponent['type'], style?: Styles): CSSProperties {
  const configuredStyle = style || {};
  const configuredMaxWidth = configuredStyle.maxWidth;
  const availableWidth = 'calc(100% - var(--sidebar-content-offset, 0px))';
  const intrinsicMaxWidth = !!configuredMaxWidth
    && /^(?:auto|min-content|max-content|fit-content(?:\(.*\))?|stretch|available|inherit|initial|unset|revert|revert-layer)$/i.test(configuredMaxWidth.trim());

  const growWebsite = componentType === 'website' && configuredStyle.height === undefined && configuredStyle.maxHeight === undefined;

  return {
    width: '100%',
    display: 'flex',
    flexGrow: growWebsite ? 1 : undefined,
    flexDirection: 'column',
    ...configuredStyle,
    ...((configuredStyle.width !== undefined || configuredMaxWidth !== undefined)
      ? {
        ...(intrinsicMaxWidth
          ? {
            width: configuredStyle.width === undefined
              ? `min(100%, ${availableWidth})`
              : `min(${configuredStyle.width}, ${availableWidth})`,
            maxWidth: configuredMaxWidth,
          }
          : {
            maxWidth: configuredMaxWidth && configuredMaxWidth !== 'none'
              ? `min(${configuredMaxWidth}, ${availableWidth})`
              : `min(100%, ${availableWidth})`,
          }),
      }
      : {}),
  };
}
