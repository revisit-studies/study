import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';
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

  const body = categoryOrder
    .flatMap((category) => Object.entries(groupIssues)
      // Only keep entries that match the current category
      .filter(([groupKey]) => groupKey.startsWith(`${category}:`))
      .map(([groupKey, pathIssues]) => {
        const [, path] = groupKey.split(':');
        const categoryLabel = formatCategoryLabel(category);

        const messages = pathIssues
          .map((error) => {
            const message = error.message || 'No message provided';
            const params = error.params || {};
            const hasParams = Object.keys(params).length > 0;

            let paramsText = '';

            if (hasParams) {
              if (Object.keys(params).length === 1 && 'action' in params) {
                paramsText = `\n      - ${(params as { action: string }).action}`;
              } else {
                paramsText = ` - ${JSON.stringify(params)}`;
              }
            }

            return `    - ${message}${paramsText}`;
          })
          .join('\n');

        return `**${categoryLabel}**\n\n- \`${path}\`\n${messages}`;
      }))
    .join('\n\n');

  const text = `${baseHeader}\n\n${body}`;

  return (
    <ReactMarkdownWrapper text={text} />
  );
}
