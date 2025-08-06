/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import ReactMarkdown, { Components } from 'react-markdown';
import {
  Image, Text, Title, Anchor, List, Table,
} from '@mantine/core';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

export function ReactMarkdownWrapper({ text, required }: { text: string; required?: boolean }) {
  const components: Partial<Components> = {
    img({
      node, width, height, ...props
    }) { return <Image {...props} h={height} w={width} ref={undefined} />; },
    p({ node, ...props }) { return <Text {...props} pb={8} fw="inherit" ref={undefined} />; },
    h1({ node, ...props }) { return <Title {...props} order={1} {...props} pb={12} />; },
    h2({ node, ...props }) { return <Title {...props} order={2} {...props} pb={12} />; },
    h3({ node, ...props }) { return <Title {...props} order={3} {...props} pb={12} />; },
    h4({ node, ...props }) { return <Title {...props} order={4} {...props} pb={12} />; },
    h5({ node, ...props }) { return <Title {...props} order={5} {...props} pb={12} />; },
    h6({ node, ...props }) { return <Title {...props} order={6} {...props} pb={12} />; },
    a({ node, ...props }) { return <Anchor {...props} ref={undefined} />; },
    ul({ node, ...props }) { return <List withPadding {...props} pb={8} />; },
    ol({ node, type, ...props }) { return <List type="ordered" withPadding {...props} pb={8} />; },
    table({ node, ...props }) { return <Table {...props} mb={12} borderColor="grey" />; },
    thead({ node, ...props }) { return <Table.Thead {...props} />; },
    tbody({ node, ...props }) { return <Table.Tbody {...props} />; },
    tr({ node, ...props }) { return <Table.Tr {...props} />; },
    th({ node, ...props }) { return <Table.Th {...props} />; },
    td({ node, ...props }) { return <Table.Td {...props} />; },
  };

  const asteriskIcon = ('<span style="color: #fa5252; margin-left: 4px">*</span>');

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ReactMarkdown components={components} rehypePlugins={[rehypeRaw] as any} remarkPlugins={[remarkGfm]}>
      {text + (required ? `${asteriskIcon}` : '')}
    </ReactMarkdown>
  );
}
