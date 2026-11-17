import { Flex, Text, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { createContext, useCallback, useContext } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { compileTemplate } from '../../utils/handlebars';

export const OptionTextTemplateContext = createContext<{
  parameters: Record<string, unknown>;
  data: Record<string, unknown>;
} | null>(null);

export function useOptionTextTemplate() {
  const context = useContext(OptionTextTemplateContext);
  return useCallback((value: string, noEscape = false) => (
    context ? compileTemplate(value, context.parameters, { noEscape, data: context.data }) : value
  ), [context]);
}

export function OptionLabel({
  label,
  infoText,
  button = false,
  wrap = false,
  fw,
}: {
  label: string;
  infoText?: string;
  button?: boolean;
  wrap?: boolean;
  fw?: number;
}) {
  const template = useOptionTextTemplate();
  const renderedLabel = template(label, button);
  const renderedInfoText = infoText && template(infoText, true);
  return (
    <Flex
      direction="row"
      gap={4}
      align="center"
      justify={button ? 'center' : undefined}
      style={button || wrap ? { minWidth: 0, flexWrap: 'wrap' } : undefined}
    >
      {/* Option labels don't need bottom padding and should use small text size */}
      {button ? <Text size="sm" fw={fw} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{renderedLabel}</Text>
        : wrap
          ? <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><ReactMarkdownWrapper text={renderedLabel} inline /></div>
          : <ReactMarkdownWrapper text={renderedLabel} inline />}
      {renderedInfoText && (
        <Tooltip label={renderedInfoText} multiline maw={400} position="bottom">
          <IconInfoCircle size={16} opacity={0.5} />
        </Tooltip>
      )}
    </Flex>
  );
}
