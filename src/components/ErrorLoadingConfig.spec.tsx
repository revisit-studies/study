import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { describe, expect, test } from 'vitest';
import { ParsedConfig, StudyConfig } from '../parser/types';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';

describe('ErrorLoadingConfig', () => {
  test('separates non-combinable grouped messages on new lines', () => {
    const issues: ParsedConfig<StudyConfig>['errors'] = [
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: 'First validation issue',
        params: {},
      },
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: 'Second validation issue',
        params: {},
      },
    ];

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ErrorLoadingConfig issues={issues} type="error" />
      </MantineProvider>,
    );

    expect(html).toMatch(/First validation issue[\s\S]*<br\/>[\s\S]*Second validation issue/);
  });

  test('keeps dominant required-property message for anyOf alternatives', () => {
    const issues: ParsedConfig<StudyConfig>['errors'] = [
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: "must have required property 'type'",
        params: { missingProperty: 'type' },
      },
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: "must have required property 'type'",
        params: { missingProperty: 'type' },
      },
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: "must have required property 'type'",
        params: { missingProperty: 'type' },
      },
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: "must have required property 'config'",
        params: { missingProperty: 'config' },
      },
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: "must have required property 'baseComponent'",
        params: { missingProperty: 'baseComponent' },
      },
      {
        category: 'invalid-config',
        instancePath: 'root',
        message: 'must match a schema in anyOf',
        params: {},
      },
    ];

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ErrorLoadingConfig issues={issues} type="error" />
      </MantineProvider>,
    );
    const textOnly = html.replace(/<[^>]*>/g, ' ');

    expect(textOnly).toMatch(/Missing required property\s+type/);
    expect(textOnly).not.toMatch(/Missing required property\s+config/);
    expect(textOnly).not.toMatch(/Missing required property\s+baseComponent/);
    expect(textOnly).not.toContain('must match a schema in anyOf');
  });

  test('renders default-contact-email warning category and message', () => {
    const issues: ParsedConfig<StudyConfig>['errors'] = [
      {
        category: 'default-contact-email',
        instancePath: '/uiConfig/contactEmail',
        message: 'The contact email is set to the default value `contact@revisit.dev`. Please update it to your own email address.',
        params: {
          action: 'Update the contactEmail field in uiConfig to your own email address',
        },
      },
    ];

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ErrorLoadingConfig issues={issues} type="error" />
      </MantineProvider>,
    );
    const textOnly = html.replace(/<[^>]*>/g, ' ');

    expect(textOnly).toContain('Default Contact Email');
    expect(textOnly).toContain('contact@revisit.dev');
  });
});
