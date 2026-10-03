import { PREFIX } from './Prefix';

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/**
 * Absolute URL of the directory containing the stimulus, used as the iframe's `<base href>`.
 * A srcdoc document's own URL is `about:srcdoc`, so relative paths inside it would otherwise
 * resolve against nothing - the base tag restores the behavior the file had when loaded by src.
 */
export function getBaseHref(templatedPath: string): string {
  const withoutQuery = templatedPath.split(/[?#]/)[0];
  // Leading slashes would make `${PREFIX}${path}` scheme-relative ("//study/..." means host "study").
  const normalized = withoutQuery.replace(/^\/+/, '');
  const dir = normalized.replace(/[^/]*$/, '');
  return new URL(`${PREFIX}${dir}`, window.location.origin).href;
}

/**
 * Splice the reVISit prelude into a compiled HTML stimulus: a `<base href>` so relative assets
 * still resolve, and the iframe/trial ids that `revisit-communicate.js` normally reads from the
 * query string (a srcdoc document has none).
 *
 * The prelude is spliced into the string rather than inserted via DOMParser, because parsing and
 * re-serializing relocates author markup that sits outside `<body>`/`</html>`. Known limitation:
 * a literal `<head>`/`<html>` inside a comment or string before the real one mis-targets.
 */
export function buildIframeSrcDoc(
  html: string,
  { baseHref, iframeId, trialId }: { baseHref: string; iframeId: string; trialId: string },
): string {
  // The first `<base href>` wins per spec, so don't override one the author already set.
  const hasBase = /<base\b[^>]*href/i.test(html);
  const params = JSON.stringify({ id: iframeId, trialid: trialId }).replace(/</g, '\\u003c');
  const base = hasBase ? '' : `<base href="${escapeAttribute(baseHref)}">`;
  const prelude = `${base}<script>window.__REVISIT_PARAMS__ = ${params};</script>`;

  // `<base>` has to precede every element that carries a relative URL, so aim for first-in-head.
  const headMatch = html.match(/<head\b[^>]*>/i);
  if (headMatch?.index !== undefined) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + prelude + html.slice(at);
  }

  const htmlMatch = html.match(/<html\b[^>]*>/i);
  if (htmlMatch?.index !== undefined) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return `${html.slice(0, at)}<head>${prelude}</head>${html.slice(at)}`;
  }

  // Never insert ahead of the doctype - that would force quirks mode.
  const doctypeMatch = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctypeMatch) {
    const at = doctypeMatch[0].length;
    return html.slice(0, at) + prelude + html.slice(at);
  }

  return prelude + html;
}
