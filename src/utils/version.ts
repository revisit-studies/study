import appVersion from '../../VERSION?raw';

export const APP_VERSION = appVersion.trim();

export function formatAppVersion(version: string): string {
  return `v${version}`;
}
