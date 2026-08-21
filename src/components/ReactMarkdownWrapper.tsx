import ReactMarkdown, { Components } from 'react-markdown';
import {
  Code, Text, Title, Anchor, List, Table, Image,
} from '@mantine/core';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root, Element, Text as HastText } from 'hast';
import { useCallback } from 'react';
import { PREFIX } from '../utils/Prefix';

// Type guards
function isHastText(node: unknown): node is HastText {
  return !!node && typeof node === 'object' && (node as HastText).type === 'text';
}
function isElement(node: unknown): node is Element {
  return !!node && typeof node === 'object' && (node as Element).type === 'element';
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
    if (!required) return;
    if (!tree) return;

    let ln: Element | null = null;
    let lp: Element | Root | null = null;
    let lastTextNode: HastText | null = null;

    visit(tree, (node) => {
      if (isHastText(node) && node.value.trim().length > 0) {
        lastTextNode = node;
      }
    });

    if (lastTextNode) {
      // Recursively find the last node
      visit(tree, (node, _, parent) => {
        if (!isElement(node)) return;
        if (!node.children) return;

        const containsLastText = node.children.some((child) => child === lastTextNode);
        if (containsLastText) {
          ln = node;
          lp = parent!;
        }
      });
    }

    const lastNode = ln as Element | null;
    const lastParent = lp as Element | null;
    if (lastNode !== null) {
      // Create a new text node with the asterisk
      const asteriskNode: Element = {
        type: 'element',
        tagName: 'span',
        properties: { style: 'color: #fa5252; margin-left: 4px' },
        children: [
          {
            type: 'text',
            value: '*',
          },
        ],
      };
      // Modify the last child to attach the asterisk to the last word if it's text, or to the node if it's an element
      if (isHastText(lastNode.children.at(-1))) {
        // Preserve original spacing while attaching the asterisk to the final token.
        const textNode = lastNode.children.at(-1) as HastText;
        const match = textNode.value.match(/^([\s\S]*?)(\S+)(\s*)$/);

        if (!match) {
          lastNode.children.push(asteriskNode);
          return;
        }

        const [, beforeLastWord, lastWord, afterLastWord] = match;
        const newTextNode: Element = {
          type: 'element',
          tagName: 'span',
          properties: {},
          children: [
            ...(beforeLastWord.length > 0 ? [{
              type: 'text' as const,
              value: beforeLastWord,
            }] : []),
            {
              type: 'element',
              tagName: 'span',
              properties: { style: 'white-space: nowrap' },
              children: [
                {
                  type: 'text',
                  value: lastWord,
                },
                asteriskNode,
              ],
            },
            ...(afterLastWord.length > 0 ? [{
              type: 'text' as const,
              value: afterLastWord,
            }] : []),
          ],
        };
        // Replace the last text node with the new element node
        lastNode.children.splice(lastNode.children.length - 1, 1, newTextNode);
      } else {
        // Modify the whole element to add the asterisk with whitespace nowrap
        const newLastNode: Element = {
          type: 'element',
          tagName: 'span',
          properties: { style: 'white-space: nowrap; display: inline-flex;' },
          children: [
            lastNode,
            asteriskNode,
          ],
        };
        // This is a bit hacky, but we need to replace the lastNode in its parent's children array
        if (lastParent) {
          const index = lastParent.children.indexOf(lastNode);
          if (index !== -1) {
            lastParent.children.splice(index, 1, newLastNode);
          }
        }
      }
    }
  }, [required]);
  return text.length > 0 && (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ReactMarkdown components={componentsToUse} rehypePlugins={[rehypeRaw, rehypeAsterisk] as any} remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>
  );
}
