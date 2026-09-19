import type { CSSProperties } from 'react';
import type { IndividualComponent, Styles } from '../parser/types';

export function getComponentContainerStyle(componentType: IndividualComponent['type'], style?: Styles): CSSProperties {
  // Page padding is applied once by StepRenderer, around stimulus and responses.
  const configuredStyle = { ...style };
  delete configuredStyle.padding;

  const growWebsite = componentType === 'website' && configuredStyle.height === undefined && configuredStyle.maxHeight === undefined;

  return {
    width: '100%',
    display: 'flex',
    flexGrow: growWebsite ? 1 : undefined,
    flexDirection: 'column',
    ...configuredStyle,
    ...((configuredStyle.width !== undefined && configuredStyle.maxWidth === undefined) ? { maxWidth: '100%' } : {}),
  };
}
