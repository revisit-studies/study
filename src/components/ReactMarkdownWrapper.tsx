/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import ReactMarkdown from 'react-markdown';
import {
  Image, Text, Title, Anchor, List,
} from '@mantine/core';
import { ReactNode } from 'react';
import rehypeRaw from 'rehype-raw';
import { IconAsterisk } from '@tabler/icons-react';

export default function ReactMarkdownWrapper({ text, required }: { text: string; required?: boolean }) {
  const components = {
    img: ({ node, ...props }: { node: unknown; height?: string | number, width?: string | number }) => <Image {...props} h={props.height} w={props.width} />,
    p: ({ node, ...props }: { node: unknown; }) => <Text {...props} pb={8} />,
    h1: ({ node, ...props }: { node: unknown; }) => <Title order={1} {...props} pb={12} />,
    h2: ({ node, ...props }: { node: unknown; }) => <Title order={2} {...props} pb={12} />,
    h3: ({ node, ...props }: { node: unknown; }) => <Title order={3} {...props} pb={12} />,
    h4: ({ node, ...props }: { node: unknown; }) => <Title order={4} {...props} pb={12} />,
    h5: ({ node, ...props }: { node: unknown; }) => <Title order={5} {...props} pb={12} />,
    h6: ({ node, ...props }: { node: unknown; }) => <Title order={6} {...props} pb={12} />,
    a: ({ node, ...props }: { node: unknown; }) => <Anchor {...props} />,
    ul: ({ node, ...props }: { node: unknown; children: ReactNode; }) => <List withPadding {...props} pb={8} />,
    ol: ({ node, ...props }: { node: unknown; children: ReactNode; }) => <List type="ordered" withPadding {...props} pb={8} />,
  };

  const asteriskIcon = ('<span style="color: #fa5252">*</span>');

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ReactMarkdown components={components} rehypePlugins={[rehypeRaw] as any}>
      {text + (required ? ` ${asteriskIcon}` : '')}
    </ReactMarkdown>
  );
}
