/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import ReactMarkdown, { Components } from 'react-markdown';
import {
  Image, Text, Title, Anchor, List,
} from '@mantine/core';
import rehypeRaw from 'rehype-raw';

export function ReactMarkdownWrapper({ text, required }: { text: string; required?: boolean }) {
  const components: Partial<Components> = {
    img({
      node, width, height, ...props
    }) { return <Image {...props} h={height} w={width} ref={undefined} />; },
    p({ node, ...props }) { return <Text {...props} pb={8} fw="inherit" ref={undefined} />; },
    h1({ node, ...props }) { return <Title {...props} order={1} pb={12} />; },
    h2({ node, ...props }) { return <Title {...props} order={2} pb={12} />; },
    h3({ node, ...props }) { return <Title {...props} order={3} pb={12} />; },
    h4({ node, ...props }) { return <Title {...props} order={4} pb={12} />; },
    h5({ node, ...props }) { return <Title {...props} order={5} pb={12} />; },
    h6({ node, ...props }) { return <Title {...props} order={6} pb={12} />; },
    a({ node, ...props }) { return <Anchor {...props} ref={undefined} />; },
    ul({ node, ...props }) { return <List withPadding {...props} pb={8} />; },
    ol({ node, type, ...props }) { return <List {...props} type="ordered" withPadding pb={8} />; },
  };

  const splitText = text.trim().split(' ');
  const lastWord = splitText.at(-1);

  const asteriskIcon = ('<span style="color: #fa5252; margin-left: 4px">*</span>');
  const spannedLastWord = lastWord ? `<span style="white-space: nowrap;">${lastWord + (required ? `${asteriskIcon}` : '')}</span>` : '';

  const modifiedText = `${splitText.slice(0, -1).join(' ')} ${spannedLastWord}`;

  return text.length > 0 && (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ReactMarkdown components={components} rehypePlugins={[rehypeRaw] as any}>
      {modifiedText}
    </ReactMarkdown>
  );
}
