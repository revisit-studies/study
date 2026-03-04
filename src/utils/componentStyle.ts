import type { CSSProperties } from 'react';
import type { IndividualComponent, Styles } from '../parser/types';

export function getComponentContainerStyle(componentType: IndividualComponent['type'], style?: Styles): CSSProperties {
  const configuredStyle = style || {};

  return {
    width: '100%',
    display: 'flex',
    flexGrow: componentType === 'website' ? 1 : undefined,
    flexDirection: 'column',
    ...configuredStyle,
    ...((configuredStyle.width !== undefined && configuredStyle.maxWidth === undefined) ? { maxWidth: '100%' } : {}),
  };
}
