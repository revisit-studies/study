import {
  Badge, Code, Collapse, Divider, Group, List, Paper, Stack, Text, UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react';
import { ParsedConfig, StudyConfig, ErrorWarningCategory } from '../parser/types';

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

  // Render inline code wrapped in backticks
  const renderInlineCode = (text: string) => {
    // Split the text by backticks
    const parts = text.split(/`([^`]+)`/g);
    return parts.map((part, index) => (index % 2 === 1
      ? (
        <Code key={`${part}-${index}`}>
          {' '}
          {part}
        </Code>
      )
      : <Text key={`${part}-${index}`} component="span">{part}</Text>
    ));
  };

  const getActionText = (params: unknown) => (
    params && typeof params === 'object' && 'action' in params ? (params as { action: string }).action : null
  );

  // Try to combine similar messages with a common pattern
  const combineMessages = (messages: string[]) => {
    if (messages.length <= 1) return messages;

    const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
    const groups: Array<{ key: string; prefix?: string; suffix?: string; items: string[]; raw?: boolean }> = [];
    const groupIndex = new Map<string, number>();

    messages.forEach((msg) => {
      // Looking for patterns like "Component X is not defined in components object"
      const match = msg.match(/^(.*?\s+)(.+?)(\s+(?:is|are|not).*)$/);
      if (match) {
        const [, prefix, item, suffix] = match;
        const key = `${prefix}|||${suffix}`;
        const index = groupIndex.get(key);
        if (index === undefined) {
          groupIndex.set(key, groups.length);
          groups.push({
            key, prefix, suffix, items: [item],
          });
        } else {
          groups[index].items.push(item);
        }
      } else {
        const key = `raw|||${msg}`;
        const index = groupIndex.get(key);
        if (index === undefined) {
          groupIndex.set(key, groups.length);
          groups.push({ key, items: [msg], raw: true });
        }
      }
    });

    return groups.map((group) => {
      if (group.raw) return group.items[0];

      const subject = group.items.length === 1 ? group.items[0] : listFormatter.format(group.items);
      let suffix = group.suffix ?? '';

      if (group.items.length > 1) {
        suffix = suffix.replace(/\bis\b/, 'are');
      } else {
        suffix = suffix.replace(/\bare\b/, 'is');
      }

      return `${group.prefix}${subject}${suffix}`;
    });
  };

  const groupCategory = issues.reduce<Record<ErrorWarningCategory, typeof issues>>((acc, error) => {
    const { category } = error;

    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push(error);
    return acc;
  }, {} as Record<ErrorWarningCategory, typeof issues>);

  const groupIssues = Object.entries(groupCategory).reduce<Record<string, typeof issues>>((acc, [category, categoryIssues]) => {
    categoryIssues.forEach((error) => {
      const path = error.instancePath || 'root';
      const key = `${category}:${path}`;

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(error);
    });
    return acc;
  }, {});

  const title = type === 'error' ? 'Errors' : 'Warnings';
  const headerText = type === 'error'
    ? 'Your study could not be built because of errors in the study config.'
    : 'There are potential issues in your study config.';
  const badgeColor = type === 'error' ? 'red' : 'orange';
  const issueLabel = type === 'error' ? 'Error' : 'Warning';
  const count = issues.length;
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
          {categoryOrder
            .map((category) => ({
              category,
              entries: Object.entries(groupIssues).filter(([groupKey]) => groupKey.startsWith(`${category}:`)),
            }))
            .filter(({ entries }) => entries.length > 0)
            .map(({ category, entries }, index, visibleCategories) => {
              const categoryCount = entries.reduce((sum, [, pathIssues]) => sum + pathIssues.length, 0);
              const categoryActions = entries.flatMap(([, pathIssues]) => pathIssues.map((error) => getActionText(error.params)));
              const uniqueActions = new Set(categoryActions.filter(Boolean) as string[]);
              const sharedAction = categoryActions.length > 0 && uniqueActions.size === 1 && !categoryActions.includes(null) ? Array.from(uniqueActions)[0] : null;

              return (
                <Stack key={category} gap={0}>
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>{formatCategoryLabel(category)}</Text>
                    <Badge size="sm" variant="light" color={badgeColor}>
                      {categoryCount}
                      {' '}
                      {issueLabel}
                      {categoryCount === 1 ? '' : 's'}
                    </Badge>
                  </Group>
                  {sharedAction && (
                    <Text size="sm" c="dimmed">{sharedAction}</Text>
                  )}
                  <List size="xs" spacing="xs" mt="xs" listStyleType="none">
                    {entries.map(([groupKey, pathIssues]) => {
                      const [, path] = groupKey.split(':');
                      const messages = pathIssues.map((error) => error.message || 'No message provided');
                      const combinedMessages = combineMessages(messages);
                      const actionTexts = pathIssues.map((error) => getActionText(error.params)).filter(Boolean);
                      const itemUniqueActions = new Set(actionTexts as string[]);
                      const actionText = itemUniqueActions.size === 1 ? Array.from(itemUniqueActions)[0] : null;

                      return (
                        <List.Item key={groupKey}>
                          <Stack>
                            <Text size="sm">
                              <Code component="span" fw="bold" bg="none">
                                {path}
                                :
                              </Code>
                              {combinedMessages.map((msg, idx) => (
                                <Text key={`${groupKey}-msg-${idx}`} component="span">
                                  {renderInlineCode(msg)}
                                  {idx < combinedMessages.length - 1 && (
                                    <Text component="span"> </Text>
                                  )}
                                </Text>
                              ))}
                            </Text>
                            {actionText && !sharedAction && (
                              <Text size="sm" c="dimmed">
                                {actionText}
                              </Text>
                            )}
                          </Stack>
                        </List.Item>
                      );
                    })}
                  </List>
                  {index < visibleCategories.length - 1 && (
                    <Divider mt="xs" />
                  )}
                </Stack>
              );
            })}
        </Stack>
      </Collapse>
    </Paper>
  );
}
