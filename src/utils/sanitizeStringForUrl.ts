/* eslint-disable no-useless-escape */
export function sanitizeStringForUrl(fileName: string) {
  const groups = fileName.split('/') || [];
  const last = groups[groups.length - 1];
  return last
    .replace(/\.[^\.]+$/, '') // Remove extension
    .replace('.', '_') // Replace other periods
    .replace(' ', '_') // Replace spaces
    .replace('/', '_'); // Replace paths
}
