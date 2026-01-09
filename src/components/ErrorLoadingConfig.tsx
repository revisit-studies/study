import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';
import { ParsedConfig, StudyConfig } from '../parser/types';

export function ErrorLoadingConfig({ issues, type }: { issues: ParsedConfig<StudyConfig>['errors'], type: 'error' | 'warning'}) {
  const groupedIssues = issues.reduce<Record<string, typeof issues>>((acc, error) => {
    const path = error.instancePath || 'root';
    const key = path;

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(error);
    return acc;
  }, {});

  const unusedComponents = issues.filter((issue) => issue.message?.includes('is defined in components object but not used'));
  const unusedCount = unusedComponents.length;

  const baseHeader = type === 'error'
    ? 'There was an issue loading the study config. Please check the following issues:'
    : 'There were some warnings while loading the study config. Please check the following warnings:';

  const header = unusedCount > 0
    ? `${baseHeader}\n\nYou have **${unusedCount} component${unusedCount === 1 ? '' : 's'}** not used.`
    : baseHeader;

  const body = Object.entries(groupedIssues)
    .map(([path, pathIssues]) => {
      const cleanedPath = path.replace(/^\//, '');
      const [category] = cleanedPath.split('/');
      const title = category || 'root';
      const messages = pathIssues
        .map((error) => {
          const message = error.message || 'No message provided';
          const params = error.params || {};
          const hasParams = Object.keys(params).length > 0;

          let paramsText = '';
          if (hasParams) {
            if (Object.keys(params).length === 1 && 'action' in params) {
              paramsText = ` - ${(params as { action: string }).action}`;
            } else {
              paramsText = ` - ${JSON.stringify(params)}`;
            }
          }

          return `    - ${message}${paramsText}`;
        })
        .join('\n');

      return `**${title}**\n\n- \`${path}\`\n${messages}`;
    })
    .join('\n\n');

  const text = `${header}\n\n${body}`;

  return (
    <ReactMarkdownWrapper text={text} />
  );
}
