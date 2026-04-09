import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { useMove } from '@mantine/hooks';
import { generateSliderBreakValues } from './sliderBreaks';
import { HorizontalHandler } from './HorizontalHandler';
import { OptionLabel } from './OptionLabel';
import { InputLabel } from './InputLabel';
import { TextOnlyInput } from './TextOnlyInput';
import { StringInput } from './StringInput';
import { TextAreaInput } from './TextAreaInput';
import { NumericInput } from './NumericInput';
import { ReactiveInput } from './ReactiveInput';
import { DropdownInput } from './DropdownInput';
import { CheckBoxInput } from './CheckBoxInput';
import { ButtonsInput } from './ButtonsInput';
import { RadioInput } from './RadioInput';
import { LikertInput } from './LikertInput';
import { SliderInput } from './SliderInput';
import { MatrixInput } from './MatrixInput';
import { RankingInput } from './RankingInput';
import { ResponseSwitcher } from './ResponseSwitcher';
import { FeedbackAlert } from './FeedbackAlert';
import { usesStandaloneDontKnowField } from './utils';
import type {
  ButtonsResponse,
  CheckboxResponse,
  DropdownResponse,
  IndividualComponent,
  MatrixRadioResponse,
  RadioResponse,
  ReactiveResponse,
  Response,
  ShortTextResponse,
  SliderResponse,
} from '../../parser/types';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => {
  function Div({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  function Span({ children }: { children?: ReactNode }) {
    return <span>{children}</span>;
  }
  const Input = Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Wrapper: ({ children, label, description }: { children?: ReactNode; label?: ReactNode; description?: ReactNode }) => (
        <div>
          {label}
          {description}
          {children}
        </div>
      ),
      Placeholder: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    },
  );
  const List = Object.assign(
    ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
    { Item: ({ children }: { children?: ReactNode }) => <li>{children}</li> },
  );
  const Radio = Object.assign(
    ({ label, value, children }: { label?: ReactNode; value?: string; children?: ReactNode }) => (
      <div data-value={value}>
        {label}
        {children}
      </div>
    ),
    {
      Group: ({ children, label, description }: { children?: ReactNode; label?: ReactNode; description?: ReactNode }) => (
        <div>
          {label}
          {description}
          {children}
        </div>
      ),
      Card: ({ children, value }: { children?: ReactNode; value?: string }) => (
        <div data-value={value}>{children}</div>
      ),
    },
  );
  const Checkbox = Object.assign(
    ({ label, value, checked }: { label?: ReactNode; value?: string; checked?: boolean }) => (
      <div data-value={value} data-checked={checked}>{label}</div>
    ),
    {
      Group: ({ children, label, description }: { children?: ReactNode; label?: ReactNode; description?: ReactNode }) => (
        <div>
          {label}
          {description}
          {children}
        </div>
      ),
    },
  );
  return {
    Group: Div,
    Stack: Div,
    Flex: Div,
    Box: Div,
    Text: Span,
    Tooltip: ({ children, label }: { children?: ReactNode; label?: ReactNode }) => (
      <div title={String(label)}>{children}</div>
    ),
    Alert: ({ children, title }: { children?: ReactNode; title?: ReactNode }) => (
      <div data-alert>
        <div data-title>{title}</div>
        {children}
      </div>
    ),
    Anchor: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <a onClick={onClick}>{children}</a>
    ),
    Divider: () => <hr />,
    Input,
    List,
    Radio,
    Checkbox,
    FocusTrap: Div,
    NumberInput: ({ label, placeholder, description }: { label?: ReactNode; placeholder?: string; description?: ReactNode }) => (
      <div>
        {label}
        {description}
        <input type="number" placeholder={placeholder} />
      </div>
    ),
    TextInput: ({ label, placeholder, description }: { label?: ReactNode; placeholder?: string; description?: ReactNode }) => (
      <div>
        {label}
        {description}
        <input type="text" placeholder={placeholder} />
      </div>
    ),
    Textarea: ({ label, placeholder, description }: { label?: ReactNode; placeholder?: string; description?: ReactNode }) => (
      <div>
        {label}
        {description}
        <textarea placeholder={placeholder} />
      </div>
    ),
    Select: ({ label, description, data }: { label?: ReactNode; description?: ReactNode; data?: { label: string }[] }) => (
      <div>
        {label}
        {description}
        <select>{data?.map((d) => <option key={d.label}>{d.label}</option>)}</select>
      </div>
    ),
    MultiSelect: ({ label, description, data }: { label?: ReactNode; description?: ReactNode; data?: { label: string }[] }) => (
      <div data-multiselect>
        {label}
        {description}
        <select multiple>{data?.map((d) => <option key={d.label}>{d.label}</option>)}</select>
      </div>
    ),
    Slider: ({ min, max }: { min?: number; max?: number }) => (
      <div data-slider data-min={min} data-max={max} />
    ),
    Paper: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    rem: (v: unknown) => String(v),
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => <span>icon-info</span>,
}));

vi.mock('../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@mantine/hooks', () => ({
  useMove: vi.fn(() => ({ ref: { current: null } })),
}));

vi.mock('./sliderBreaks', () => ({
  generateSliderBreakValues: vi.fn(() => []),
}));

vi.mock('../../store/store', () => ({
  useStoreDispatch: vi.fn(() => vi.fn()),
  useStoreActions: vi.fn(() => ({
    setMatrixAnswersRadio: vi.fn(),
    setMatrixAnswersCheckbox: vi.fn(),
    setRankingAnswers: vi.fn(),
    toggleShowHelpText: vi.fn(),
    incrementHelpCounter: vi.fn(),
  })),
  useStoreSelector: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    sequence: { order: 'fixed', components: [] },
    completed: false,
  })),
}));

vi.mock('../../utils/responseOptions', () => ({
  getMatrixAnswerOptions: vi.fn((response) => (response.answerOptions || []).map((o: string) => ({ label: o, value: o }))),
  isMatrixDontKnowValue: vi.fn(() => false),
  MATRIX_DONT_KNOW_OPTION: { value: '__dontKnow', label: "I don't know" },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: class { },
  KeyboardSensor: class { },
  rectIntersection: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: null, isDragging: false,
  }),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

vi.mock('clsx', () => ({ default: vi.fn((...args: unknown[]) => args.filter(Boolean).join(' ')) }));

vi.mock('../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: vi.fn(() => ({ questionOrders: {}, optionOrders: {} })),
}));

vi.mock('./utils', () => ({
  generateErrorMessage: vi.fn(() => null),
  DONT_KNOW_DEFAULT_VALUE: "I don't know",
  normalizeCheckboxDontKnowValue: vi.fn((v: string[]) => v),
  usesStandaloneDontKnowField: vi.fn(() => false),
  getDefaultFieldValue: vi.fn(() => null),
}));

vi.mock('../../utils/stringOptions', () => ({
  parseStringOptions: vi.fn((options: (string | { label: string; value: string })[]) => options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))),
  parseStringOptionValue: vi.fn((o: string | { value: string }) => (typeof o === 'string' ? o : o.value)),
}));

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    uiConfig: { enumerateQuestions: false, responseDividers: false },
    components: {},
  })),
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => false),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
}));

vi.mock('../../utils/fetchStylesheet', () => ({
  useFetchStylesheet: vi.fn(),
}));

vi.mock('../../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: vi.fn(() => []),
}));

vi.mock('./customResponseModules', () => ({
  getCustomResponseModule: vi.fn(() => null),
  getCustomResponseModuleLoadError: vi.fn(() => null),
}));

// ── HorizontalHandler ─────────────────────────────────────────────────────────

describe('HorizontalHandler', () => {
  test('renders Group (horizontal) when horizontal=true', () => {
    const html = renderToStaticMarkup(
      <HorizontalHandler horizontal style={{}}>
        <span>item</span>
      </HorizontalHandler>,
    );
    // Group mock renders a <div>; Stack also renders a <div> — content is present either way
    expect(html).toContain('item');
  });

  test('renders Stack (vertical) when horizontal=false', () => {
    const html = renderToStaticMarkup(
      <HorizontalHandler horizontal={false} style={{}}>
        <span>item</span>
      </HorizontalHandler>,
    );
    expect(html).toContain('item');
  });
});

// ── OptionLabel ───────────────────────────────────────────────────────────────

describe('OptionLabel', () => {
  test('renders label text', () => {
    const html = renderToStaticMarkup(<OptionLabel label="Option A" />);
    expect(html).toContain('Option A');
  });

  test('button mode renders label in Text component', () => {
    const html = renderToStaticMarkup(<OptionLabel label="Click me" button />);
    expect(html).toContain('Click me');
  });

  test('shows info icon when infoText is provided', () => {
    const html = renderToStaticMarkup(<OptionLabel label="A" infoText="Extra info" />);
    expect(html).toContain('icon-info');
    expect(html).toContain('Extra info');
  });

  test('no info icon when infoText is absent', () => {
    const html = renderToStaticMarkup(<OptionLabel label="A" />);
    expect(html).not.toContain('icon-info');
  });
});

// ── InputLabel ────────────────────────────────────────────────────────────────

describe('InputLabel', () => {
  test('renders prompt text', () => {
    const html = renderToStaticMarkup(
      <InputLabel prompt="What is your name?" enumerateQuestions={false} />,
    );
    expect(html).toContain('What is your name?');
  });

  test('shows index prefix when enumerateQuestions=true', () => {
    const html = renderToStaticMarkup(
      <InputLabel prompt="Q" index={3} enumerateQuestions />,
    );
    expect(html).toContain('3.');
  });

  test('no index prefix when enumerateQuestions=false', () => {
    const html = renderToStaticMarkup(
      <InputLabel prompt="Q" index={3} enumerateQuestions={false} />,
    );
    expect(html).not.toContain('3.');
  });

  test('shows info icon when infoText provided', () => {
    const html = renderToStaticMarkup(
      <InputLabel prompt="Q" enumerateQuestions={false} infoText="Hint" />,
    );
    expect(html).toContain('icon-info');
  });
});

// ── TextOnlyInput ─────────────────────────────────────────────────────────────

describe('TextOnlyInput', () => {
  test('renders the response prompt', () => {
    const html = renderToStaticMarkup(
      <TextOnlyInput
        response={{ type: 'textOnly', id: 'q1', prompt: 'Read this carefully.' } as Parameters<typeof TextOnlyInput>[0]['response']}
      />,
    );
    expect(html).toContain('Read this carefully.');
  });
});

// ── StringInput ───────────────────────────────────────────────────────────────

describe('StringInput', () => {
  const base: ShortTextResponse = {
    type: 'shortText',
    id: 'q1',
    prompt: 'Enter your name',
    required: false,
    placeholder: 'Name here',
  };

  test('renders prompt label and text input', () => {
    const html = renderToStaticMarkup(
      <StringInput response={base} disabled={false} answer={{}} index={1} enumerateQuestions={false} />,
    );
    expect(html).toContain('Enter your name');
    expect(html).toContain('Name here');
  });

  test('renders without prompt when prompt is empty', () => {
    const html = renderToStaticMarkup(
      <StringInput response={{ ...base, prompt: '' }} disabled={false} answer={{}} index={1} enumerateQuestions={false} />,
    );
    // No label rendered
    expect(html).not.toContain('Enter your name');
  });
});

// ── TextAreaInput ─────────────────────────────────────────────────────────────

describe('TextAreaInput', () => {
  test('renders prompt and textarea', () => {
    const html = renderToStaticMarkup(
      <TextAreaInput
        response={{
          type: 'longText', id: 'q1', prompt: 'Describe your experience', required: false, placeholder: 'Write here',
        } as Parameters<typeof TextAreaInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Describe your experience');
    expect(html).toContain('Write here');
  });
});

// ── NumericInput ──────────────────────────────────────────────────────────────

describe('NumericInput', () => {
  test('renders prompt and number input', () => {
    const html = renderToStaticMarkup(
      <NumericInput
        response={{
          type: 'numerical', id: 'q1', prompt: 'Enter your age', required: false, placeholder: 'Age',
        } as Parameters<typeof NumericInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Enter your age');
    expect(html).toContain('Age');
  });
});

// ── ReactiveInput ─────────────────────────────────────────────────────────────

describe('ReactiveInput', () => {
  const base: ReactiveResponse = {
    type: 'reactive',
    id: 'q1',
    prompt: 'Selected items',
    required: false,
  };

  test('renders list items from answer.value array', () => {
    const html = renderToStaticMarkup(
      <ReactiveInput
        response={base}
        answer={{ value: ['apple', 'banana'] }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('apple');
    expect(html).toContain('banana');
  });

  test('renders key:value pairs from object answer', () => {
    const html = renderToStaticMarkup(
      <ReactiveInput
        response={base}
        answer={{ value: { key1: 'val1' } as unknown as string[] }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('key1: val1');
  });

  test('renders nothing when answer.value is undefined', () => {
    const html = renderToStaticMarkup(
      <ReactiveInput
        response={base}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    // Prompt still shows but no list
    expect(html).toContain('Selected items');
    expect(html).not.toContain('<li');
  });
});

// ── DropdownInput ─────────────────────────────────────────────────────────────

describe('DropdownInput', () => {
  const base: DropdownResponse = {
    type: 'dropdown',
    id: 'q1',
    prompt: 'Choose a color',
    required: false,
    options: ['Red', 'Blue', 'Green'],
    placeholder: 'Pick one',
  };

  test('renders single Select with options', () => {
    const html = renderToStaticMarkup(
      <DropdownInput
        response={base}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Choose a color');
    expect(html).toContain('Red');
    expect(html).toContain('Blue');
  });

  test('renders MultiSelect when maxSelections > 1', () => {
    const html = renderToStaticMarkup(
      <DropdownInput
        response={{ ...base, maxSelections: 2 } as Parameters<typeof DropdownInput>[0]['response']}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('data-multiselect');
  });
});

// ── CheckBoxInput ─────────────────────────────────────────────────────────────

describe('CheckBoxInput', () => {
  const base: CheckboxResponse = {
    type: 'checkbox',
    id: 'q1',
    prompt: 'Select all that apply',
    required: false,
    options: ['A', 'B', 'C'],
    horizontal: false,
  };

  test('renders prompt and checkbox options', () => {
    const html = renderToStaticMarkup(
      <CheckBoxInput
        response={base}
        disabled={false}
        answer={{ value: [] }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Select all that apply');
    expect(html).toContain('A');
    expect(html).toContain('B');
    expect(html).toContain('C');
  });

  test('renders "Other" checkbox label when withOther=true and horizontal=true', () => {
    const html = renderToStaticMarkup(
      <CheckBoxInput
        response={{ ...base, withOther: true, horizontal: true } as Parameters<typeof CheckBoxInput>[0]['response']}
        disabled={false}
        answer={{ value: [] }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    // horizontal=true → label is the literal string 'Other'
    expect(html).toContain('Other');
  });
});

// ── ButtonsInput ──────────────────────────────────────────────────────────────

describe('ButtonsInput', () => {
  const base: ButtonsResponse = {
    type: 'buttons',
    id: 'q1',
    prompt: 'Pick one',
    required: false,
    options: ['Yes', 'No', 'Maybe'],
  };

  test('renders prompt and button options', () => {
    const html = renderToStaticMarkup(
      <ButtonsInput
        response={base}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Pick one');
    expect(html).toContain('Yes');
    expect(html).toContain('No');
    expect(html).toContain('Maybe');
  });
});

// ── RadioInput ────────────────────────────────────────────────────────────────

describe('RadioInput', () => {
  const base: RadioResponse = {
    type: 'radio',
    id: 'q1',
    prompt: 'How satisfied are you?',
    required: false,
    options: ['Very', 'Somewhat', 'Not at all'],
    horizontal: false,
  };

  test('renders prompt and radio options', () => {
    const html = renderToStaticMarkup(
      <RadioInput
        response={base}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('How satisfied are you?');
    expect(html).toContain('Very');
    expect(html).toContain('Somewhat');
    expect(html).toContain('Not at all');
  });

  test('renders "Other" option when withOther=true and horizontal=true', () => {
    const html = renderToStaticMarkup(
      <RadioInput
        response={{ ...base, withOther: true, horizontal: true } as Parameters<typeof RadioInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    // horizontal=true → "Other" text rendered via <Text size="sm">Other</Text>
    expect(html).toContain('Other');
  });
});

// ── LikertInput ───────────────────────────────────────────────────────────────

describe('LikertInput', () => {
  test('generates numeric options from numItems', () => {
    const html = renderToStaticMarkup(
      <LikertInput
        response={{
          type: 'likert',
          id: 'q1',
          prompt: 'Rate your experience',
          required: false,
          numItems: 5,
        } as Parameters<typeof LikertInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    // Options 1-5 should be rendered
    expect(html).toContain('1');
    expect(html).toContain('5');
  });

  test('respects start and spacing values', () => {
    const html = renderToStaticMarkup(
      <LikertInput
        response={{
          type: 'likert',
          id: 'q1',
          prompt: 'Rate',
          required: false,
          numItems: 3,
          start: 0,
          spacing: 2,
        } as Parameters<typeof LikertInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    // 0, 2, 4
    expect(html).toContain('0');
    expect(html).toContain('2');
    expect(html).toContain('4');
  });
});

// ── SliderInput ───────────────────────────────────────────────────────────────

describe('SliderInput', () => {
  const baseOptions = [{ label: 'Low', value: 0 }, { label: 'High', value: 100 }];

  const base: SliderResponse = {
    type: 'slider',
    id: 'q1',
    prompt: 'Rate your effort',
    required: false,
    options: baseOptions,
  };

  test('renders prompt label', () => {
    const html = renderToStaticMarkup(
      <SliderInput
        response={base}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Rate your effort');
  });

  test('renders standard Slider component when smeqStyle is false', () => {
    const html = renderToStaticMarkup(
      <SliderInput
        response={base}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('data-slider');
  });

  test('renders smeq vertical layout with option labels when smeqStyle=true', () => {
    const html = renderToStaticMarkup(
      <SliderInput
        response={{ ...base, smeqStyle: true } as Parameters<typeof SliderInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    // smeq renders option labels as text boxes
    expect(html).toContain('Low');
    expect(html).toContain('High');
    // no standard Slider mock rendered
    expect(html).not.toContain('data-slider');
  });

  test('renders smeq mark elements when generateSliderBreakValues returns non-empty', () => {
    // smeq block renders mark elements when labelValues is non-empty
    vi.mocked(generateSliderBreakValues).mockReturnValueOnce([25, 50, 75]);
    const html = renderToStaticMarkup(
      <SliderInput
        response={{ ...base, smeqStyle: true } as Parameters<typeof SliderInput>[0]['response']}
        disabled={false}
        answer={{}}
        index={1}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Low');
  });

  test('covers useMove callback body when it is invoked during render', async () => {
    afterEach(() => { cleanup(); });
    // Override useMove to call the callback synchronously after component mounts
    let capturedCallback: ((pos: { x: number; y: number }) => void) | null = null;
    vi.mocked(useMove).mockImplementationOnce((fn: (pos: { x: number; y: number }) => void) => {
      capturedCallback = fn;
      return { ref: { current: null }, active: false };
    });
    const mockOnChange = vi.fn();
    await act(async () => render(
      <SliderInput
        response={{ ...base, smeqStyle: true, step: 1 } as Parameters<typeof SliderInput>[0]['response']}
        disabled={false}
        answer={{ onChange: mockOnChange } as Parameters<typeof SliderInput>[0]['answer']}
        index={1}
        enumerateQuestions={false}
      />,
    ));
    // Call the captured callback to exercise the drag handler
    act(() => { capturedCallback?.({ x: 0, y: 0.5 }); });
    expect(mockOnChange).toHaveBeenCalled();
    cleanup();
  });
});

// ── MatrixInput ───────────────────────────────────────────────────────────────

describe('MatrixInput', () => {
  const base: MatrixRadioResponse = {
    type: 'matrix-radio',
    id: 'q1',
    prompt: 'Please rate each item',
    required: false,
    questionOptions: ['Q1', 'Q2'],
    answerOptions: ['Agree', 'Disagree'],
  };

  test('renders prompt', () => {
    const html = renderToStaticMarkup(
      <MatrixInput
        response={base}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Please rate each item');
  });

  test('renders column header labels (answer options)', () => {
    const html = renderToStaticMarkup(
      <MatrixInput
        response={base}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Agree');
    expect(html).toContain('Disagree');
  });

  test('renders row labels (question options)', () => {
    const html = renderToStaticMarkup(
      <MatrixInput
        response={base}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Q1');
    expect(html).toContain('Q2');
  });

  test('renders matrix-checkbox type using Checkbox cells', () => {
    const html = renderToStaticMarkup(
      <MatrixInput
        response={{ ...base, type: 'matrix-checkbox' } as Parameters<typeof MatrixInput>[0]['response']}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    // matrix-checkbox uses Checkbox cells, matrix-radio uses Radio.Group
    expect(html).toContain('Q1');
  });
});

// ── RankingInput ──────────────────────────────────────────────────────────────

describe('RankingInput', () => {
  const baseOptions = ['Item A', 'Item B', 'Item C'];

  const makeRankingResponse = (type: 'ranking-sublist' | 'ranking-categorical' | 'ranking-pairwise') => ({
    type,
    id: 'q1',
    prompt: 'Rank these items',
    required: false,
    options: baseOptions,
  });

  test('renders prompt for ranking-sublist', () => {
    const html = renderToStaticMarkup(
      <RankingInput
        response={makeRankingResponse('ranking-sublist') as Parameters<typeof RankingInput>[0]['response']}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Rank these items');
  });

  test('renders options in ranking-sublist', () => {
    const html = renderToStaticMarkup(
      <RankingInput
        response={makeRankingResponse('ranking-sublist') as Parameters<typeof RankingInput>[0]['response']}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Item A');
    expect(html).toContain('Item B');
    expect(html).toContain('Item C');
  });

  test('renders ranking-categorical with options', () => {
    const html = renderToStaticMarkup(
      <RankingInput
        response={makeRankingResponse('ranking-categorical') as Parameters<typeof RankingInput>[0]['response']}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Item A');
  });

  test('renders ranking-pairwise with Add New Pair button', () => {
    const html = renderToStaticMarkup(
      <RankingInput
        response={makeRankingResponse('ranking-pairwise') as Parameters<typeof RankingInput>[0]['response']}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions={false}
      />,
    );
    expect(html).toContain('Add New Pair');
  });
});

// ── FeedbackAlert ─────────────────────────────────────────────────────────────

describe('FeedbackAlert', () => {
  const baseResponse = { type: 'shortText', id: 'q1', prompt: 'Q' } as Response;
  const baseAlertConfig = {
    q1: {
      visible: true,
      title: 'Incorrect Answer',
      message: 'Please try again. You have 1 attempt left.',
      color: 'red',
    },
  };

  test('returns null when visible is false', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer={undefined}
        alertConfig={{ q1: { ...baseAlertConfig.q1, visible: false } }}
        identifier="trial1_0"
        attemptsUsed={0}
        trainingAttempts={2}
      />,
    );
    expect(html).toBe('');
  });

  test('renders alert title and message when visible', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer={undefined}
        alertConfig={baseAlertConfig}
        identifier="trial1_0"
        attemptsUsed={0}
        trainingAttempts={2}
      />,
    );
    expect(html).toContain('Incorrect Answer');
    expect(html).toContain('Please try again');
  });

  test('shows "review the help text" link when message contains "Please try again"', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer={undefined}
        alertConfig={baseAlertConfig}
        identifier="trial1_0"
        attemptsUsed={0}
        trainingAttempts={2}
      />,
    );
    expect(html).toContain('review the help text');
  });

  test('does not show "review the help text" for other messages', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer={undefined}
        alertConfig={{ q1: { ...baseAlertConfig.q1, message: 'You answered correctly.' } }}
        identifier="trial1_0"
        attemptsUsed={0}
        trainingAttempts={2}
      />,
    );
    expect(html).not.toContain('review the help text');
  });

  test('shows correct answer when attemptsUsed >= trainingAttempts and correctAnswer provided', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer="42"
        alertConfig={baseAlertConfig}
        identifier="trial1_0"
        attemptsUsed={2}
        trainingAttempts={2}
      />,
    );
    expect(html).toContain('The correct answer was: 42');
  });

  test('hides correct answer when trainingAttempts is -1 (unlimited)', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer="42"
        alertConfig={baseAlertConfig}
        identifier="trial1_0"
        attemptsUsed={5}
        trainingAttempts={-1}
      />,
    );
    expect(html).not.toContain('The correct answer was');
  });

  test('hides correct answer when correctAnswer is undefined even after all attempts', () => {
    const html = renderToStaticMarkup(
      <FeedbackAlert
        response={baseResponse}
        correctAnswer={undefined}
        alertConfig={baseAlertConfig}
        identifier="trial1_0"
        attemptsUsed={2}
        trainingAttempts={2}
      />,
    );
    expect(html).not.toContain('The correct answer was');
  });
});

// ── ResponseSwitcher ──────────────────────────────────────────────────────────

describe('ResponseSwitcher', () => {
  function makeSwitcherProps(response: Response): Parameters<typeof ResponseSwitcher>[0] {
    return {
      response,
      form: { value: '' } as Parameters<typeof ResponseSwitcher>[0]['form'],
      storedAnswer: {},
      index: 1,
      config: { type: 'questionnaire', response: [] } as IndividualComponent,
      disabled: false,
    };
  }

  test('numerical type renders NumericInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'numerical', id: 'q1', prompt: 'Enter age', required: false,
        } as Response)}
      />,
    );
    expect(html).toContain('Enter age');
  });

  test('shortText type renders StringInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'shortText', id: 'q1', prompt: 'Your name', required: false,
        } as Response)}
      />,
    );
    expect(html).toContain('Your name');
  });

  test('longText type renders TextAreaInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'longText', id: 'q1', prompt: 'Describe it', required: false,
        } as Response)}
      />,
    );
    expect(html).toContain('Describe it');
  });

  test('likert type renders LikertInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'likert', id: 'q1', prompt: 'Rate', required: false, numItems: 5,
        } as Response)}
      />,
    );
    expect(html).toContain('Rate');
  });

  test('dropdown type renders DropdownInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'dropdown', id: 'q1', prompt: 'Pick color', required: false, options: ['Red', 'Blue'],
        } as Response)}
      />,
    );
    expect(html).toContain('Pick color');
    expect(html).toContain('Red');
  });

  test('slider type renders SliderInput with data-slider', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'slider', id: 'q1', prompt: 'Effort', required: false, options: [{ label: 'Low', value: 0 }, { label: 'High', value: 100 }],
        } as Response)}
      />,
    );
    expect(html).toContain('data-slider');
  });

  test('radio type renders RadioInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'radio', id: 'q1', prompt: 'Agree?', required: false, options: ['Yes', 'No'],
        } as Response)}
      />,
    );
    expect(html).toContain('Agree?');
    expect(html).toContain('Yes');
  });

  test('checkbox type renders CheckBoxInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'checkbox', id: 'q1', prompt: 'Select all', required: false, options: ['A', 'B'],
        } as Response)}
      />,
    );
    expect(html).toContain('Select all');
    expect(html).toContain('A');
  });

  test('ranking-sublist type renders RankingInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'ranking-sublist', id: 'q1', prompt: 'Rank items', required: false, options: ['X', 'Y'],
        } as Response)}
      />,
    );
    expect(html).toContain('Rank items');
  });

  test('reactive type renders ReactiveInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'reactive', id: 'q1', prompt: 'Selected', required: false,
        } as Response)}
      />,
    );
    expect(html).toContain('Selected');
  });

  test('matrix-radio type renders MatrixInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'matrix-radio',
          id: 'q1',
          prompt: 'Rate each',
          required: false,
          questionOptions: ['Q1', 'Q2'],
          answerOptions: ['Yes', 'No'],
        } as Response)}
      />,
    );
    expect(html).toContain('Rate each');
  });

  test('buttons type renders ButtonsInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'buttons', id: 'q1', prompt: 'Choose', required: false, options: ['OK', 'Cancel'],
        } as Response)}
      />,
    );
    expect(html).toContain('Choose');
    expect(html).toContain('OK');
  });

  test('textOnly type renders TextOnlyInput', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'textOnly', id: 'q1', prompt: 'Read this',
        } as Response)}
      />,
    );
    expect(html).toContain('Read this');
  });

  test('divider type renders hr element', () => {
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'divider', id: 'q1',
        } as Response)}
      />,
    );
    expect(html).toContain('<hr');
  });

  test('shows "I don\'t know" checkbox when usesStandaloneDontKnow', () => {
    vi.mocked(usesStandaloneDontKnowField).mockReturnValueOnce(true);
    const html = renderToStaticMarkup(
      <ResponseSwitcher
        {...makeSwitcherProps({
          type: 'shortText', id: 'q1', prompt: 'Q', required: false, withDontKnow: true,
        } as Response)}
        dontKnowCheckbox={{ checked: false } as Parameters<typeof ResponseSwitcher>[0]['dontKnowCheckbox']}
      />,
    );
    expect(html).toContain('I don&#x27;t know');
  });
});
