// @vitest-environment jsdom

import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { buildIframeSrcDoc, getBaseHref } from '../iframeSrcDoc';

const mockPrefix = { value: '/' };

vi.mock('../Prefix', () => ({
  get PREFIX() { return mockPrefix.value; },
}));

const options = { baseHref: 'http://localhost:3000/my-study/assets/', iframeId: 'iframe-1', trialId: 'trial-1' };

describe('getBaseHref', () => {
  beforeEach(() => {
    mockPrefix.value = '/';
  });

  test('returns the absolute directory of a nested path', () => {
    expect(getBaseHref('my-study/assets/chart.html')).toBe(`${window.location.origin}/my-study/assets/`);
  });

  test('normalizes a leading slash so the base is not scheme-relative', () => {
    expect(getBaseHref('/my-study/assets/chart.html')).toBe(`${window.location.origin}/my-study/assets/`);
  });

  test('strips query and hash suffixes', () => {
    expect(getBaseHref('my-study/assets/chart.html?a=1#top')).toBe(`${window.location.origin}/my-study/assets/`);
  });

  test('handles a file at the root of the public folder', () => {
    expect(getBaseHref('chart.html')).toBe(`${window.location.origin}/`);
  });

  test('respects a non-root PREFIX', () => {
    mockPrefix.value = '/study/';
    expect(getBaseHref('my-study/assets/chart.html')).toBe(`${window.location.origin}/study/my-study/assets/`);
  });
});

describe('buildIframeSrcDoc', () => {
  test('injects the prelude immediately after an existing head tag', () => {
    const result = buildIframeSrcDoc('<!doctype html><html><head><title>T</title></head><body></body></html>', options);
    expect(result).toContain('<head><base href="http://localhost:3000/my-study/assets/"><script>window.__REVISIT_PARAMS__ =');
    expect(result.indexOf('__REVISIT_PARAMS__')).toBeLessThan(result.indexOf('<title>'));
    expect(result).toContain('{"id":"iframe-1","trialid":"trial-1"}');
  });

  test('creates a head when the document has an html tag but no head', () => {
    const result = buildIframeSrcDoc('<html><body>hi</body></html>', options);
    expect(result).toBe(`<html><head><base href="${options.baseHref}"><script>window.__REVISIT_PARAMS__ = {"id":"iframe-1","trialid":"trial-1"};</script></head><body>hi</body></html>`);
  });

  test('keeps the doctype first when there is no html tag', () => {
    const result = buildIframeSrcDoc('<!DOCTYPE html>\n<body>hi</body>', options);
    expect(result.startsWith('<!DOCTYPE html><base href=')).toBe(true);
  });

  test('prepends the prelude to a bare fragment', () => {
    const result = buildIframeSrcDoc('<p>hi</p>', options);
    expect(result.startsWith('<base href=')).toBe(true);
    expect(result.endsWith('<p>hi</p>')).toBe(true);
  });

  test('does not override a base tag the author already set', () => {
    const result = buildIframeSrcDoc('<html><head><base href="/elsewhere/"></head></html>', options);
    expect(result).not.toContain(options.baseHref);
    expect(result.match(/<base/g)).toHaveLength(1);
    expect(result).toContain('__REVISIT_PARAMS__');
  });

  test('escapes the base href as an attribute value', () => {
    const result = buildIframeSrcDoc('<html><head></head></html>', { ...options, baseHref: 'http://x/a&b"c<d/' });
    expect(result).toContain('<base href="http://x/a&amp;b&quot;c&lt;d/">');
  });

  test('prevents a script breakout through the injected ids', () => {
    const result = buildIframeSrcDoc('<html><head></head></html>', { ...options, trialId: '</script><script>alert(1)</script>' });
    expect(result).not.toContain('<script>alert(1)');
    expect(result).toContain('\\u003c/script>\\u003cscript>alert(1)');
  });
});
