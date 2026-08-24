import ReactMarkdown, { Components } from 'react-markdown';
import {
  Code, Text, Title, Anchor, List, Table, Image,
} from '@mantine/core';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import type { Root, Element, Text as HastText } from 'hast';
import { useCallback } from 'react';
import { PREFIX } from '../utils/Prefix';

// Type guards
function isHastText(node: unknown): node is HastText {
  return !!node && typeof node === 'object' && (node as HastText).type === 'text';
}

type ParentWithChildren = Element | Root;

function hasChildren(node: unknown): node is ParentWithChildren {
  return !!node && typeof node === 'object' && Array.isArray((node as ParentWithChildren).children);
}

function findFirstTextWithParent(
  node: ParentWithChildren,
): { textNode: HastText; parent: ParentWithChildren } | null {
  for (const child of node.children) {
    if (isHastText(child) && child.value.trim().length > 0) {
      return { textNode: child, parent: node };
    }
    if (hasChildren(child)) {
      const found = findFirstTextWithParent(child);
      if (found) return found;
    }
  }
  return null;
}

const markdownComponents = (inline?: boolean): Partial<Components> => ({
  p({ node: _, ...props }) { return inline ? <Text {...props} component="span" size="sm" /> : <Text {...props} pb={8} fw="inherit" ref={undefined} />; },
  h1({ node: _, ...props }) { return <Title {...props} order={1} pb={inline ? undefined : 12} />; },
  h2({ node: _, ...props }) { return <Title {...props} order={2} pb={inline ? undefined : 12} />; },
  h3({ node: _, ...props }) { return <Title {...props} order={3} pb={inline ? undefined : 12} />; },
  h4({ node: _, ...props }) { return <Title {...props} order={4} pb={inline ? undefined : 12} />; },
  h5({ node: _, ...props }) { return <Title {...props} order={5} pb={inline ? undefined : 12} />; },
  h6({ node: _, ...props }) { return <Title {...props} order={6} pb={inline ? undefined : 12} />; },
  a({ node: _, ...props }) { return <Anchor {...props} ref={undefined} />; },
  code({ node: _, ...props }) { return <Code {...props} />; },
  ul({ node: _, ...props }) { return <List withPadding {...props} pb={inline ? undefined : 8} />; },
  ol({ node: _, type: _type, ...props }) { return <List {...props} type="ordered" withPadding pb={inline ? undefined : 8} />; },
  table({ node: _, ...props }) { return <Table {...props} mb={12} borderColor="grey" />; },
  thead({ node: _, ...props }) { return <Table.Thead {...props} />; },
  tbody({ node: _, ...props }) { return <Table.Tbody {...props} />; },
  tr({ node: _, ...props }) { return <Table.Tr {...props} />; },
  th({ node: _, ...props }) { return <Table.Th {...props} />; },
  td({ node: _, ...props }) { return <Table.Td {...props} />; },
  img({
    node: _, width, height, src, ...props
  }) { return <Image {...props} h={height} w={width} src={src?.startsWith('http') ? src : `${PREFIX}${src}`} />; },
});

export function ReactMarkdownWrapper({ text, required, inline }: { text: string; required?: boolean; inline?: boolean }) {
  const componentsToUse = markdownComponents(inline);
  const rehypeAsterisk = useCallback(() => (tree: Root) => {
    if (!required || !tree) return;

    const found = findFirstTextWithParent(tree);
    if (!found) return;
    const { textNode, parent } = found;

    const asteriskNode: Element = {
      type: 'element',
      tagName: 'span',
      properties: { className: 'required-asterisk' },
      children: [{ type: 'text', value: '* ' }],
    };
    const index = parent.children.indexOf(textNode);
    if (index !== -1) {
      parent.children.splice(index, 0, asteriskNode);
    }
  }, [required]);
  return text.length > 0 && (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ReactMarkdown components={componentsToUse} rehypePlugins={[rehypeRaw, rehypeAsterisk] as any} remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>
  );
}
