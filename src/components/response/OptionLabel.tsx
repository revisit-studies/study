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
  fw,
}: {
  label: string;
  infoText?: string;
  button?: boolean;
  fw?: number;
}) {
  const template = useOptionTextTemplate();
  const renderedLabel = template(label, button);
  const renderedInfoText = infoText && template(infoText, true);
  return (
    <Flex direction="row" gap={4} align="center" justify={button ? 'center' : undefined}>
      {/* Option labels don't need bottom padding and should use small text size */}
      {button ? <Text size="sm" fw={fw}>{renderedLabel}</Text>
        : <ReactMarkdownWrapper text={renderedLabel} inline />}
      {renderedInfoText && (
        <Tooltip label={renderedInfoText} multiline maw={400} position="bottom">
          <IconInfoCircle size={16} opacity={0.5} />
        </Tooltip>
      )}
    </Flex>
  );
}
