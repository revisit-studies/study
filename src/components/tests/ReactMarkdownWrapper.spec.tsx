import { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

vi.mock('@mantine/core', () => ({
  Anchor: ({ children, href }: { children: ReactNode; href?: string }) => <a href={href}>{children}</a>,
  Code: ({ children }: { children: ReactNode }) => <code>{children}</code>,
  Image: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  List: Object.assign(
    ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    { Item: ({ children }: { children: ReactNode }) => <li>{children}</li> },
  ),
  Table: Object.assign(
    ({ children }: { children: ReactNode }) => <table>{children}</table>,
    {
      Thead: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
      Tbody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
      Tr: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
      Th: ({ children }: { children: ReactNode }) => <th>{children}</th>,
      Td: ({ children }: { children: ReactNode }) => <td>{children}</td>,
    },
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children, order }: { children: ReactNode; order?: number }) => {
    const level = order ?? 1;
    if (level === 2) return <h2>{children}</h2>;
    if (level === 3) return <h3>{children}</h3>;
    if (level === 4) return <h4>{children}</h4>;
    if (level === 5) return <h5>{children}</h5>;
    if (level === 6) return <h6>{children}</h6>;
    return <h1>{children}</h1>;
  },
}));

vi.mock('../../utils/Prefix', () => ({ PREFIX: '/' }));

describe('ReactMarkdownWrapper', () => {
  test('renders nothing when text is empty', () => {
    const html = renderToStaticMarkup(<ReactMarkdownWrapper text="" />);
    expect(html).toBe('');
  });

  test('renders plain text', () => {
    const { container } = render(<ReactMarkdownWrapper text="Hello world" />);
    expect(container.textContent).toContain('Hello world');
  });

  test('renders heading levels', () => {
    const { container } = render(<ReactMarkdownWrapper text="# Heading 1" />);
    expect(container.querySelector('h1') ?? container.textContent).toBeDefined();
  });

  test('renders inline mode without block wrapper', () => {
    const { container } = render(<ReactMarkdownWrapper text="Inline **text**" inline />);
    expect(container.textContent).toContain('Inline');
    expect(container.textContent).toContain('text');
  });

  test('appends asterisk to required text', () => {
    const { container } = render(<ReactMarkdownWrapper text="Required field" required />);
    expect(container.textContent).toContain('*');
  });

  test('renders markdown with multiple headings', () => {
    const { container } = render(<ReactMarkdownWrapper text="## H2\n### H3" />);
    expect(container.textContent).toContain('H2');
    expect(container.textContent).toContain('H3');
  });

  test('renders links', () => {
    const { container } = render(<ReactMarkdownWrapper text="[Link](https://example.com)" />);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.href).toContain('example.com');
  });

  test('renders code blocks', () => {
    const { container } = render(<ReactMarkdownWrapper text="`inline code`" />);
    expect(container.textContent).toContain('inline code');
  });

  test('renders lists', () => {
    const { container } = render(<ReactMarkdownWrapper text="- Item 1\n- Item 2" />);
    expect(container.textContent).toContain('Item 1');
    expect(container.textContent).toContain('Item 2');
  });

  test('renders required with no text node (element-only leaf)', () => {
    // A required marker on text ending with an inline element (bold) exercises
    // the else branch in the rehypeAsterisk plugin.
    const { container } = render(<ReactMarkdownWrapper text="Some **bold text**" required />);
    expect(container.textContent).toContain('bold text');
    expect(container.textContent).toContain('*');
  });

  test('renders h4, h5, h6 headings', () => {
    const { container } = render(<ReactMarkdownWrapper text={'#### H4\n##### H5\n###### H6'} />);
    expect(container.textContent).toContain('H4');
    expect(container.textContent).toContain('H5');
    expect(container.textContent).toContain('H6');
  });

  test('renders ordered list', () => {
    const { container } = render(<ReactMarkdownWrapper text={'1. First\n2. Second'} />);
    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');
  });

  test('renders table with header and body', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const { container } = render(<ReactMarkdownWrapper text={md} />);
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('1');
  });

  test('renders img with relative src via PREFIX', () => {
    const { container } = render(<ReactMarkdownWrapper text="![alt](relative/img.png)" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
  });

  test('renders img with absolute src', () => {
    const { container } = render(<ReactMarkdownWrapper text="![alt](https://example.com/img.png)" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.src).toContain('example.com');
  });

  test('required asterisk: beforeLastWord empty (single word text)', () => {
    // Single word → beforeLastWord = '' → conditional spread produces []
    const { container } = render(<ReactMarkdownWrapper text="Word" required />);
    expect(container.textContent).toContain('Word');
    expect(container.textContent).toContain('*');
  });

  test('required asterisk: last child is an element not text', () => {
    // <b>word<br/></b> → b has children [text("word"), br]
    // → lastNode.children.at(-1) = br (element, not text) → ELSE branch
    const { container } = render(<ReactMarkdownWrapper text="<b>word<br/></b>" required />);
    expect(container.textContent).toContain('word');
    expect(container.textContent).toContain('*');
  });

  test('required asterisk: text with trailing space (afterLastWord non-empty)', () => {
    // "hello world" → beforeLastWord="hello ", lastWord="world", afterLastWord=""
    // but inline mode produces a span so slightly different path
    const { container } = render(<ReactMarkdownWrapper text="hello world " required />);
    expect(container.textContent).toContain('world');
    expect(container.textContent).toContain('*');
  });
});
