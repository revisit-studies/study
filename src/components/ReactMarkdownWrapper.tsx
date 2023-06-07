import ReactMarkdown from 'react-markdown';
import { Image,  Text, Title, Anchor, List } from '@mantine/core';
import { ReactNode } from 'react';

export default function ReactMarkdownWrapper({ text }: { text: string; }) {
  const components = {
    img: ({ node, ...props }: { node: unknown; }) => <Image {...props} />,
    p: ({ node, ...props }: { node: unknown; }) => <Text {...props} />,
    h1: ({ node, ...props }: { node: unknown; }) => <Title order={1} {...props} />,
    h2: ({ node, ...props }: { node: unknown; }) => <Title order={2} {...props} />,
    h3: ({ node, ...props }: { node: unknown; }) => <Title order={3} {...props} />,
    h4: ({ node, ...props }: { node: unknown; }) => <Title order={4} {...props} />,
    h5: ({ node, ...props }: { node: unknown; }) => <Title order={5} {...props} />,
    h6: ({ node, ...props }: { node: unknown; }) => <Title order={6} {...props} />,
    a: ({ node, ...props }: { node: unknown; }) => <Anchor {...props} />,
    ul: ({ node, ...props }: { node: unknown; children: ReactNode; }) => <List withPadding {...props} />,
    ol: ({ node, ...props }: { node: unknown; children: ReactNode; }) => <List type="ordered" withPadding {...props} />,
  };

  return <>
    <ReactMarkdown components={components}>{text}</ReactMarkdown>
  </>;
}
