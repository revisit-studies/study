import { ErrorObject } from 'ajv';
import ReactMarkdownWrapper from './ReactMarkdownWrapper';

export function ErrorLoadingConfig({ errors }: {errors: ErrorObject<string, Record<string, unknown>, unknown>[]}) {
  const text = `
      There was an issue loading the study config. Please check the following errors:  

      ${errors.map((error) => `- You have an error at ${error.instancePath || 'root'}: ${error.message} - ${JSON.stringify(error.params)}  `).join('\n')}
    `.replace(/\n\s+/g, '\n');
  return (
    <ReactMarkdownWrapper text={text} />
  );
}
