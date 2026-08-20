import Handlebars from 'handlebars';

export function compileTemplate(text: string, parameters: Record<string, unknown> = {}, options?: { noEscape?: boolean }): string {
  try {
    return Handlebars.compile(text, { noEscape: options?.noEscape })(parameters);
  } catch (e) {
    console.error('Failed to compile handlebars template', e);
    return text;
  }
}
