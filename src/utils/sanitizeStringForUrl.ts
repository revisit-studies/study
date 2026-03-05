export function sanitizeStringForUrl(fileName: string) {
  const groups = fileName.split('/') || [];
  const last = groups[groups.length - 1];
  return last
    // Do not strip version-like suffixes as file extensions; normalize remaining characters for route safety.
    .replace(/\.(json|ya?ml|hjson)$/i, '') // Remove known file extensions
    .replace(/\./g, '_') // Replace periods
    .replace(/\s/g, '_') // Replace spaces
    .replace(/\//g, '_'); // Replace paths
}
