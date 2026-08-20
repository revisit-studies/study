import Handlebars from 'handlebars';

Handlebars.registerHelper(
  'ifEquals',
  function ifEquals(this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  },
);

export function compileTemplate(text: string, parameters: Record<string, unknown> = {}, options?: { noEscape?: boolean }): string {
  try {
    return Handlebars.compile(text, { noEscape: options?.noEscape })(parameters);
  } catch (e) {
    console.error('Failed to compile handlebars template', e);
    return text;
  }
}
