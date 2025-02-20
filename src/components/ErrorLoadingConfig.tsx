import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';
import { ParsedConfig, StudyConfig } from '../parser/types';

export function ErrorLoadingConfig({ issues, type }: { issues: ParsedConfig<StudyConfig>['errors'], type: 'error' | 'warning'}) {
  const text = `
    ${type === 'error'
    ? 'There was an issue loading the study config. Please check the following issues:'
    : 'There were some warnings while loading the study config. Please check the following warnings:'}

    ${issues.map((error) => `- You have ${type === 'error' ? 'an error' : 'a warning'} at ${error.instancePath || 'root'}: ${error.message} - ${JSON.stringify(error.params)}  `).join('\n')}
  `.replace(/\n\s+/g, '\n');

  return (
    <ReactMarkdownWrapper text={text} />
  );
}
