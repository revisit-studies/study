import { PREFIX } from './Prefix';

/** Pin our adaptive SVG to the study theme, including in Safari's SVG image renderer. */
export function getStudyLogoUrl(path: string, colorMode: 'light' | 'dark') {
  const fragment = path === 'revisitAssets/revisitLogoSquare.svg' ? `#${colorMode}` : '';
  return `${PREFIX}${path}${fragment}`;
}
