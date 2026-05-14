export function removeSearchParam(search: string, key: string): string {
  const params = new URLSearchParams(search);
  params.delete(key);

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function removeCurrentTrialFromSearch(search: string): string {
  return removeSearchParam(search, 'currentTrial');
}
