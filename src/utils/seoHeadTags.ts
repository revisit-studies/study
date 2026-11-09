// Structurally matches Vite's HtmlTagDescriptor; src can't resolve Vite's types under the app tsconfig.
export interface HeadTag {
  tag: string;
  attrs: Record<string, string>;
  children?: string;
  injectTo: 'head';
}

// Keep in sync with the static meta description in index.html.
export const SITE_DESCRIPTION = 'Studies built with reVISit, an open-source framework for designing, running, and analyzing user studies of interactive data visualizations.';

/**
 * Builds the deployment-specific head tags for index.html.
 * The canonical URL is only emitted when configured, because this app is forked and deployed under many URLs.
 * A noindex deployment (dev and preview builds) omits the canonical URL so the two signals don't conflict.
 */
export function getSeoHeadTags({ canonicalUrl, noindex = false }: { canonicalUrl?: string; noindex?: boolean }): HeadTag[] {
  const tags: HeadTag[] = [];
  let url: string | undefined;

  if (noindex) {
    tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' }, injectTo: 'head' });
  } else if (canonicalUrl?.trim()) {
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(canonicalUrl.trim());
    } catch {
      parsedUrl = null;
    }
    if (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`VITE_CANONICAL_URL must be an absolute http(s) URL, received "${canonicalUrl}".`);
    }
    url = parsedUrl.href;
    tags.push(
      { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
      { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
    );
  }

  tags.push({
    tag: 'script',
    attrs: { type: 'application/ld+json' },
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'ReVISit Studies',
      ...(url ? { url } : {}),
      description: SITE_DESCRIPTION,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      isBasedOn: 'https://github.com/revisit-studies/study',
      softwareHelp: { '@type': 'WebSite', name: 'reVISit documentation', url: 'https://revisit.dev/' },
    }),
    injectTo: 'head',
  });

  return tags;
}

/** Vite plugin that injects getSeoHeadTags for the VITE_CANONICAL_URL and VITE_NOINDEX env values. */
export function seoHeadTagsPlugin(env: Record<string, string>) {
  const tags = getSeoHeadTags({ canonicalUrl: env.VITE_CANONICAL_URL, noindex: env.VITE_NOINDEX === 'true' });
  return {
    name: 'revisit-seo-head-tags',
    transformIndexHtml: () => tags,
  };
}
