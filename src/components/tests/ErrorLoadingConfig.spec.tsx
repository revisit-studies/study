import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { describe, expect, test } from 'vitest';
import { ParsedConfig, StudyConfig } from '../../parser/types';
import { ErrorLoadingConfig } from '../ErrorLoadingConfig';

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

  test('renders default-firebase-config warning category and message', () => {
    const issues: ParsedConfig<StudyConfig>['errors'] = [
      {
        category: 'default-firebase-config',
        instancePath: 'environment/VITE_FIREBASE_CONFIG',
        message: 'This study is connected to ReVISit\'s default Firebase project. Participant data may not be saved to a backend controlled by the study designer.',
        params: {
          action: 'Set VITE_FIREBASE_CONFIG to a Firebase project controlled by the study designer or choose another storage engine',
        },
      },
    ];

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ErrorLoadingConfig issues={issues} type="warning" />
      </MantineProvider>,
    );
    const textOnly = html.replace(/<[^>]*>/g, ' ');

    expect(textOnly).toContain('Default Firebase Config');
    expect(textOnly).toContain('default Firebase project');
  });

  test('renders default-supabase-config warning category and message', () => {
    const issues: ParsedConfig<StudyConfig>['errors'] = [
      {
        category: 'default-supabase-config',
        instancePath: 'environment/VITE_SUPABASE_URL',
        message: 'This study is connected to ReVISit\'s default Supabase project. Participant data may not be saved to a backend controlled by the study designer.',
        params: {
          action: 'Set VITE_SUPABASE_URL to a Supabase project controlled by the study designer or choose another storage engine',
        },
      },
    ];

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ErrorLoadingConfig issues={issues} type="warning" />
      </MantineProvider>,
    );
    const textOnly = html.replace(/<[^>]*>/g, ' ');

    expect(textOnly).toContain('Default Supabase Config');
    expect(textOnly).toContain('default Supabase project');
  });
});
