import { ReactNode } from 'react';
import {
  cleanup, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { CustomResponseInput } from '../CustomResponseInput';
import { CustomResponse } from '../../../parser/types';
import { CustomResponseField } from '../../../store/types';

let mockModule: { default?: (props: Record<string, unknown>) => ReactNode } | null;
let mockIsAnalysis = false;
const mockCustomResponseComponent = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="custom-response">
    {String(props.isAnalysis)}
    :
    {String(props.disabled)}
    :
    {String(props.value)}
  </div>
));

vi.mock('../customResponseModules', () => ({
  getCustomResponseModule: () => mockModule,
}));

vi.mock('../../../ResourceNotFound', () => ({
  ResourceNotFound: ({ path }: { path: string }) => <div data-testid="resource-not-found">{path}</div>,
}));

vi.mock('../../../controllers/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <div data-testid="error-boundary">{children}</div>,
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

const response = {
  id: 'custom',
  type: 'custom',
  prompt: 'Custom response',
  location: 'aboveStimulus',
  path: 'library/custom-response.tsx',
  parameters: {
    threshold: 70,
  },
} as CustomResponse;

const field = {
  getInputProps: vi.fn(),
  setValue: vi.fn(),
  onBlur: vi.fn(),
} as unknown as CustomResponseField;

describe('CustomResponseInput', () => {
  beforeEach(() => {
    mockModule = null;
    mockIsAnalysis = false;
    mockCustomResponseComponent.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  test('renders ResourceNotFound when the custom response module cannot be loaded', () => {
    render(
      <CustomResponseInput
        response={response}
        disabled={false}
        value={null}
        index={0}
        enumerateQuestions={false}
        field={field}
      />,
    );

    expect(screen.getByTestId('resource-not-found').textContent).toBe('library/custom-response.tsx');
    expect(mockCustomResponseComponent).not.toHaveBeenCalled();
  });

  test('renders loaded custom response module with input props and analysis state', () => {
    mockModule = { default: mockCustomResponseComponent };
    mockIsAnalysis = true;

    render(
      <CustomResponseInput
        response={response}
        disabled
        value="Bar"
        error="Required"
        index={2}
        enumerateQuestions
        field={field}
      />,
    );

    expect(screen.getByTestId('error-boundary')).toBeDefined();
    expect(screen.getByTestId('custom-response').textContent).toBe('true:true:Bar');
    expect(mockCustomResponseComponent).toHaveBeenCalledWith(expect.objectContaining({
      response,
      parameters: { threshold: 70 },
      value: 'Bar',
      error: 'Required',
      disabled: true,
      isAnalysis: true,
      index: 2,
      enumerateQuestions: true,
      field,
    }), {});
  });
});
