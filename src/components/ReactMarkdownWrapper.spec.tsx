import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it,
} from 'vitest';
import { PREFIX } from '../utils/Prefix';
import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';

describe('ReactMarkdownWrapper', () => {
  it('renders markdown text and links', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text="# Header\n\n[link](https://example.com)" />
      </MantineProvider>,
    );

    expect(html).toContain('Header');
    expect(html).toContain('https://example.com');
  });

  it('prefixes non-http image sources', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text="![alt](assets/image.png)" />
      </MantineProvider>,
    );

    expect(html).toContain(`${PREFIX}assets/image.png`);
  });

  it('adds required marker to markdown ending in plain text', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text="Required question" required />
      </MantineProvider>,
    );

    expect(html).toContain('Required');
    expect(html).toContain('question');
    expect(html).toContain('color:#fa5252');
    expect(html).toContain('*');
  });

  it('adds required marker when markdown ends with nested element text', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text="Please review **this**" required />
      </MantineProvider>,
    );

    expect(html).toContain('white-space:nowrap');
    expect(html).toContain('color:#fa5252');
    expect(html).toContain('*');
  });

  it('adds required marker wrapper when markdown ends with a non-text element child', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text='Please review <span><img src="assets/image.png" /></span>' required />
      </MantineProvider>,
    );

    expect(html).toContain('display:inline-flex');
    expect(html).toContain('white-space:nowrap');
    expect(html).toContain('color:#fa5252');
  });

  it('renders inline markdown as span text and without required marker when not required', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text="Inline content" inline />
      </MantineProvider>,
    );

    expect(html).toContain('Inline content');
    expect(html).not.toContain('color: #fa5252');
  });

  it('renders nothing for empty markdown', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactMarkdownWrapper text="" />
      </MantineProvider>,
    );

    expect(html).not.toContain('mantine-Text-root');
    expect(html).not.toContain('Inline');
  });
});
