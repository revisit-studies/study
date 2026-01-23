import {
  Badge, Code, Group, List, Stack, Text,
} from '@mantine/core';
import { ParsedConfig, StudyConfig, ErrorWarningCategory } from '../parser/types';

export function ErrorLoadingConfig({ issues, type }: { issues: ParsedConfig<StudyConfig>['errors'], type: 'error' | 'warning' }) {
  const categoryOrder: ErrorWarningCategory[] = [
    // error
    'invalid-config',
    'undefined-config',
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

  const baseHeader = type === 'error'
    ? 'There were some issues while loading the study config. Please check the following issues:'
    : 'There were some warnings while loading the study config. Please check the following warnings:';

  const badgeColor = type === 'error' ? 'red' : 'orange';

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">{baseHeader}</Text>
      {categoryOrder.map((category) => {
        const entries = Object.entries(groupIssues).filter(([groupKey]) => groupKey.startsWith(`${category}:`));
        if (!entries.length) return null;

        const categoryCount = entries.reduce((sum, [, pathIssues]) => sum + pathIssues.length, 0);

        return (
          <Stack key={category} gap="xs" px="xs" py="4">
            <Group justify="space-between">
              <Text size="sm" fw={600}>{formatCategoryLabel(category)}</Text>
              <Badge size="xs" variant="light" color={badgeColor}>
                {categoryCount}
                {' '}
                {type === 'error'
                  ? (categoryCount === 1 ? 'Error' : 'Errors')
                  : (categoryCount === 1 ? 'Warning' : 'Warnings')}
              </Badge>
            </Group>
            <List size="xs" spacing="xs">
              {entries.flatMap(([groupKey, pathIssues]) => {
                const [, path] = groupKey.split(':');
                return pathIssues.map((error, index) => {
                  const message = error.message || 'No message provided';
                  const params = error.params || {};
                  const actionText = 'action' in params ? (params as { action: string }).action : null;

                  return (
                    <List.Item key={`${groupKey}-${index}`}>
                      <Stack gap="4">
                        <Group gap="xs" align="flex-start">
                          <Badge size="xs" variant="light" color="gray" style={{ minWidth: 50 }}>Path</Badge>
                          <Code style={{ fontSize: 12, padding: 0 }}>{path}</Code>
                        </Group>
                        <Group gap="xs" align="flex-start" wrap="nowrap">
                          <Badge size="xs" variant="light" color="gray" style={{ minWidth: 50 }}>Issue</Badge>
                          <Text size="sm">{renderInlineCode(message)}</Text>
                        </Group>
                        {actionText && (
                          <Group gap="xs" align="flex-start" wrap="wrap">
                            <Badge size="xs" variant="light" color="gray" style={{ minWidth: 50 }}>Action</Badge>
                            <Text size="sm">{actionText}</Text>
                          </Group>
                        )}
                      </Stack>
                    </List.Item>
                  );
                });
              })}
            </List>
          </Stack>
        );
      })}
    </Stack>
  );
}
