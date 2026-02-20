import {
  Badge, Code, Collapse, Divider, Group, List, Paper, Stack, Text, UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react';
import { ParsedConfig, StudyConfig, ErrorWarningCategory } from '../parser/types';
import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';

export function ErrorLoadingConfig({
  issues,
  type,
}: {
  issues: ParsedConfig<StudyConfig>['errors'];
  type: 'error' | 'warning';
}) {
  const categoryOrder: ErrorWarningCategory[] = [
    // error
    'invalid-config',
    'invalid-library-config',
    'undefined-library',
    'undefined-base-component',
    'undefined-component',
    'sequence-validation',
    'skip-validation',
    // warning
    'unused-component',
    'disabled-sidebar',
  ];

  // Format category labels by capitalizing each word and replacing hyphens with spaces
  const formatCategoryLabel = (category: ErrorWarningCategory) => category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const getActionText = (params: unknown) => (
    params && typeof params === 'object' && 'action' in params ? (params as { action: string }).action : null
  );

  // Combine messages that have same messages
  const combineMessages = (messages: string[]): string[] => {
    if (messages.length <= 1) return messages;

    const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

    const parseMessage = (msg: string) => {
      // Parse message as prefix `item` suffix and extract it into three parts
      const match = msg.match(/^(.*?)(`[^`]+`)(.*)$/);
      return match ? { prefix: match[1], item: match[2], suffix: match[3] } : null;
    };

    const haveSameStructure = (parsedMessages: Array<{ prefix: string; item: string; suffix: string }>) => {
      const template = parsedMessages[0];
      return parsedMessages.every((m) => m.prefix === template.prefix && m.suffix === template.suffix);
    };

    const pluralizeSuffix = (suffix: string, isPlural: boolean) => {
      if (!isPlural) return suffix;

      const replacements: Array<[RegExp, string]> = [
        // handle common verb pluralizations in error message suffixes
        [/\bdoes not\b/, 'do not'],
        [/\bhas\b/, 'have'],
        [/\bis\b/, 'are'],
        [/\buses\b/, 'use'],
      ];

      let result = suffix;
      for (const [pattern, replacement] of replacements) {
        result = result.replace(pattern, replacement);
      }
      return result;
    };
    const parsed = messages.map(parseMessage);
    const validParsed = parsed.filter((p) => p !== null);
    if (validParsed.length !== parsed.length || !haveSameStructure(validParsed)) return messages;

    const template = validParsed[0];
    const uniqueItems = [...new Set(validParsed.map((m) => m.item))];
    const combinedItems = listFormatter.format(uniqueItems);
    const suffix = pluralizeSuffix(template.suffix, uniqueItems.length > 1);

    return [`${template.prefix}${combinedItems}${suffix}`];
  };

  const formatIssueMessage = (issue: ParsedConfig<StudyConfig>['errors'][number]): string => {
    if (issue.message === 'must have required property') {
      const { missingProperty } = (issue.params as { missingProperty?: string });
      if (missingProperty) {
        return `Missing required property \`${missingProperty}\``;
      }
    }
    if (issue.message.startsWith('must have required property')) {
      const { missingProperty } = (issue.params as { missingProperty?: string });
      if (missingProperty) {
        return `Missing required property \`${missingProperty}\``;
      }
    }
    return issue.message || 'No message provided';
  };

  const isAnyOfIssue = (issue: ParsedConfig<StudyConfig>['errors'][number]) => issue.message === 'must match a schema in anyOf';

  const getMissingRequiredProperty = (issue: ParsedConfig<StudyConfig>['errors'][number]) => {
    if (!issue.message.includes('must have required property')) {
      return null;
    }
    const { missingProperty } = (issue.params as { missingProperty?: string });
    return typeof missingProperty === 'string' ? missingProperty : null;
  };

  const normalizeMessages = (groupedIssues: ParsedConfig<StudyConfig>['errors']): string[] => {
    const hasAnyOfIssue = groupedIssues.some(isAnyOfIssue);

    let filteredIssues = groupedIssues.filter((issue) => {
      if (!isAnyOfIssue(issue)) {
        return true;
      }
      return groupedIssues.length === 1;
    });

    // anyOf validation often includes required-property errors from alternate schemas.
    // Prefer the most frequent missing property when alternatives disagree.
    if (hasAnyOfIssue) {
      const missingPropertyCounts = new Map<string, number>();
      filteredIssues.forEach((issue) => {
        const missingProperty = getMissingRequiredProperty(issue);
        if (missingProperty) {
          missingPropertyCounts.set(missingProperty, (missingPropertyCounts.get(missingProperty) || 0) + 1);
        }
      });

      if (missingPropertyCounts.size > 1) {
        const maxCount = Math.max(...missingPropertyCounts.values());
        const dominantMissingProperties = new Set(
          Array.from(missingPropertyCounts.entries())
            .filter(([, countForProperty]) => countForProperty === maxCount)
            .map(([property]) => property),
        );

        if (dominantMissingProperties.size < missingPropertyCounts.size) {
          filteredIssues = filteredIssues.filter((issue) => {
            const missingProperty = getMissingRequiredProperty(issue);
            return !missingProperty || dominantMissingProperties.has(missingProperty);
          });
        }
      }
    }

    const formatted = filteredIssues.map(formatIssueMessage);
    const combined = combineMessages(formatted);

    // Collapse exact duplicates and show frequency to reduce noisy schema errors
    const messageCounts = new Map<string, number>();
    combined.forEach((msg) => {
      messageCounts.set(msg, (messageCounts.get(msg) || 0) + 1);
    });

    return Array.from(messageCounts.entries()).map(([msg, countForMessage]) => (
      countForMessage > 1 ? `${msg} (x${countForMessage})` : msg
    ));
  };

  type Issue = ParsedConfig<StudyConfig>['errors'][number];

  type IssueGroup = {
    action: string | null;
    path: string;
    issues: Issue[];
  };

  type CategoryGroup = {
    category: ErrorWarningCategory;
    entries: IssueGroup[];
  };

  const groupIssuesByCategory = (): CategoryGroup[] => {
    // Group by category > action > path
    const categoryMap = new Map<ErrorWarningCategory, Map<string, IssueGroup>>();

    issues.forEach((issue) => {
      const { category } = issue;
      const action = getActionText(issue.params);
      const path = issue.instancePath || 'root';
      const entryKey = `${action ?? ''}-${path}`;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Map());
      }
      const entriesMap = categoryMap.get(category)!;

      if (entriesMap.has(entryKey)) {
        entriesMap.get(entryKey)!.issues.push(issue);
      } else {
        entriesMap.set(entryKey, { action, path, issues: [issue] });
      }
    });

    return categoryOrder
      .filter((category) => categoryMap.has(category))
      .map((category) => ({
        category,
        entries: Array.from(categoryMap.get(category)!.values()),
      }));
  };

  const title = type === 'error' ? 'Errors' : 'Warnings';
  const headerText = type === 'error'
    ? 'Your study could not be built because of errors in the study config.'
    : 'There are potential issues in your study config.';
  const badgeColor = type === 'error' ? 'red' : 'orange';
  const issueLabel = type === 'error' ? 'Error' : 'Warning';
  const count = issues.length;
  // Open by default if errors, closed by default if warnings
  const [isOpen, setIsOpen] = useState(type === 'error');

  return (
    <Paper withBorder p="md" mt="xs">
      <UnstyledButton onClick={() => setIsOpen((open) => !open)} style={{ width: '100%' }}>
        <Group justify="space-between">
          <Group gap="xs">
            <IconAlertTriangle size={16} color={badgeColor} />
            <Text size="md" fw="bold" c={badgeColor}>{title}</Text>
          </Group>
          <Group gap="xs">
            {!isOpen && (
              <Badge size="sm" color={badgeColor} variant="light">
                {count}
                {' '}
                {issueLabel}
                {count === 1 ? '' : 's'}
              </Badge>
            )}
            {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>
      </UnstyledButton>
      <Text size="sm" c="dimmed">
        {headerText}
      </Text>
      <Collapse in={isOpen}>
        <Stack gap="md" mt="xs">
          {groupIssuesByCategory().map(({ category, entries }, idx, arr) => {
            const categoryCount = entries.reduce((sum, e) => sum + e.issues.length, 0);

            return (
              <Stack key={category} gap={0}>
                <Group justify="space-between">
                  <Text size="sm" fw="bold">{formatCategoryLabel(category)}</Text>
                  <Badge size="sm" variant="light" color={badgeColor}>
                    {categoryCount}
                    {' '}
                    {issueLabel}
                    {categoryCount === 1 ? '' : 's'}
                  </Badge>
                </Group>
                <List size="xs" spacing="xs" mt="xs" listStyleType="none">
                  {entries.map((item, index) => {
                    const normalizedMessages = normalizeMessages(item.issues);

                    return (
                      <List.Item key={`${item.path}-${item.action}-${index}`}>
                        <Stack gap={2}>
                          {item.action && (
                            <Text size="sm" c="dimmed">
                              {item.action}
                            </Text>
                          )}
                          <Text size="sm">
                            <Code component="span" fw="bold" bg="none">
                              {item.path}
                              :
                            </Code>
                            {normalizedMessages.map((msg, msgIdx) => (
                              <Text key={`${item.path}-${index}-${msgIdx}-msg`} component="span">
                                {msgIdx > 0 && <br />}
                                <ReactMarkdownWrapper text={msg} inline />
                              </Text>
                            ))}
                          </Text>
                        </Stack>
                      </List.Item>
                    );
                  })}
                </List>
                {idx < arr.length - 1 && (
                  <Divider mt="md" />
                )}
              </Stack>
            );
          })}
        </Stack>
      </Collapse>
    </Paper>
  );
}
