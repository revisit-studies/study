// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  HeadTag, SITE_DESCRIPTION, getSeoHeadTags, seoHeadTagsPlugin,
} from '../seoHeadTags';

function findTag(tags: HeadTag[], tag: string, key: string, value: string) {
  return tags.find((descriptor) => descriptor.tag === tag && descriptor.attrs[key] === value);
}

function jsonLd(tags: HeadTag[]) {
  return JSON.parse(findTag(tags, 'script', 'type', 'application/ld+json')!.children as string);
}

describe('getSeoHeadTags', () => {
  test('omits deployment-specific tags when no canonical URL is configured', () => {
    const tags = getSeoHeadTags({});

    expect(findTag(tags, 'link', 'rel', 'canonical')).toBeUndefined();
    expect(findTag(tags, 'meta', 'property', 'og:url')).toBeUndefined();
    expect(findTag(tags, 'meta', 'name', 'robots')).toBeUndefined();
    expect(jsonLd(tags)).toMatchObject({ '@type': 'WebApplication', name: 'ReVISit Studies', description: SITE_DESCRIPTION });
    expect(jsonLd(tags).url).toBeUndefined();
  });

  test('adds the canonical URL, og:url, and JSON-LD url when configured', () => {
    const tags = getSeoHeadTags({ canonicalUrl: ' https://revisit.dev/study/ ' });

    expect(findTag(tags, 'link', 'rel', 'canonical')?.attrs.href).toBe('https://revisit.dev/study/');
    expect(findTag(tags, 'meta', 'property', 'og:url')?.attrs.content).toBe('https://revisit.dev/study/');
    expect(jsonLd(tags).url).toBe('https://revisit.dev/study/');
  });

  test('marks noindex deployments and drops the conflicting canonical URL', () => {
    const tags = getSeoHeadTags({ canonicalUrl: 'https://revisit.dev/study/', noindex: true });

    expect(findTag(tags, 'meta', 'name', 'robots')?.attrs.content).toBe('noindex');
    expect(findTag(tags, 'link', 'rel', 'canonical')).toBeUndefined();
    expect(jsonLd(tags).url).toBeUndefined();
  });

  test.each(['/study/', 'revisit.dev/study/', 'ftp://revisit.dev/study/'])('rejects the non-absolute or non-http canonical URL %s', (canonicalUrl) => {
    expect(() => getSeoHeadTags({ canonicalUrl })).toThrow('VITE_CANONICAL_URL must be an absolute http(s) URL');
  });

  test('keeps the static meta description in index.html in sync', () => {
    const indexHtml = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
    expect(indexHtml).toContain(`<meta name="description" content="${SITE_DESCRIPTION}" />`);
    expect(indexHtml).toContain(`<meta property="og:description" content="${SITE_DESCRIPTION}" />`);
  });
});

describe('seoHeadTagsPlugin', () => {
  test.each([
    [{ VITE_CANONICAL_URL: 'https://revisit.dev/study/' }, 'canonical', false],
    [{ VITE_CANONICAL_URL: 'https://revisit.dev/study/', VITE_NOINDEX: 'true' }, 'noindex', true],
  ])('reads the deployment from the Vite env (%j)', (env, _label, noindex) => {
    const tags = seoHeadTagsPlugin(env).transformIndexHtml();

    expect(!!findTag(tags, 'meta', 'name', 'robots')).toBe(noindex);
    expect(!!findTag(tags, 'link', 'rel', 'canonical')).toBe(!noindex);
  });
});
