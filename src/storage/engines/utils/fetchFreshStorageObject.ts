/** Mutable participant/history reads must bypass browser and CDN copies of earlier revisions. */
export function fetchFreshStorageObject(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init);
  const url = new URL(request.url);
  url.searchParams.set('__revisit_fresh', crypto.randomUUID());
  return fetch(new Request(url, request), { cache: 'no-store' });
}
