import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ButtonsInput } from './ButtonsInput';
import { CheckBoxInput } from './CheckBoxInput';
import { DropdownInput } from './DropdownInput';
import { FeedbackAlert } from './FeedbackAlert';
import { HorizontalHandler } from './HorizontalHandler';
import { InputLabel } from './InputLabel';
import { LikertInput } from './LikertInput';
import { MatrixInput } from './MatrixInput';
import { NumericInput } from './NumericInput';
import { OptionLabel } from './OptionLabel';
import { RadioInput } from './RadioInput';
import { RankingInput } from './RankingInput';
import { ReactiveInput } from './ReactiveInput';
import { ResponseBlock } from './ResponseBlock';
import { ResponseSwitcher } from './ResponseSwitcher';
import { SliderInput } from './SliderInput';
import { StringInput } from './StringInput';
import { TextAreaInput } from './TextAreaInput';
import { TextOnlyInput } from './TextOnlyInput';

const mockDispatch = vi.fn();
const mockNavigate = vi.fn();

let mockStoredAnswer: Record<string, unknown> = {
  optionOrders: {},
  questionOrders: {},
  formOrder: {},
};

let mockState = {
  sequence: { components: ['comp-1', 'comp-2'] },
  completed: false,
  analysisProvState: {
    belowStimulus: undefined,
    sidebar: undefined,
    stimulus: undefined,
  },
  reactiveAnswers: {},
  matrixAnswers: {},
  rankingAnswers: {},
  trialValidation: {},
};

let mockStudyConfig = {
  components: {
    'comp-1': { previousButton: false },
    'comp-2': { previousButton: true },
  },
  uiConfig: {
    enumerateQuestions: true,
    responseDividers: false,
    provideFeedback: false,
    allowFailedTraining: true,
    trainingAttempts: 2,
    nextButtonLocation: 'belowStimulus',
    nextButtonText: 'Next',
    nextOnEnter: false,
  },
};

vi.mock('@mantine/hooks', () => ({
  useMove: () => ({ ref: vi.fn() }),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PointerSensor: {},
  KeyboardSensor: {},
  useSensor: () => ({}),
  useSensors: () => ([]),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  rectIntersection: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (arr: unknown[]) => arr,
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('clsx', () => ({
  default: (...values: string[]) => values.filter(Boolean).join(' '),
}));

vi.mock('@mantine/core', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  function Text({ children }: { children?: ReactNode }) {
    return <span>{children}</span>;
  }
  function Input({ children, placeholder }: { children?: ReactNode; placeholder?: string }) {
    return (
      <div>
        {placeholder}
        {children}
      </div>
    );
  }
  function InputWrapper({
    children, label, description, error,
  }: { children?: ReactNode; label?: ReactNode; description?: ReactNode; error?: ReactNode }) {
    return (
      <div>
        {label}
        {description}
        {error}
        {children}
      </div>
    );
  }
  Input.Wrapper = InputWrapper;

  function Checkbox({
    children, label, value, checked,
  }: {
    children?: ReactNode;
    label?: ReactNode;
    value?: string;
    checked?: boolean;
  }) {
    return (
      <div>
        {value}
        {label}
        {children}
        {checked ? 'checked' : ''}
      </div>
    );
  }
  function CheckboxGroup({
    children, label, description, error,
  }: {
    children?: ReactNode;
    label?: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
  }) {
    return (
      <div>
        {label}
        {description}
        {error}
        {children}
      </div>
    );
  }
  Checkbox.Group = CheckboxGroup;

  function Radio({ label, value }: { label?: ReactNode; value?: string }) {
    return (
      <div>
        {value}
        {label}
      </div>
    );
  }
  function RadioGroup({
    children, label, description, error,
  }: {
    children?: ReactNode;
    label?: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
  }) {
    return (
      <div>
        {label}
        {description}
        {error}
        {children}
      </div>
    );
  }
  Radio.Group = RadioGroup;
  function RadioCard({ children, value }: { children?: ReactNode; value?: string }) {
    return (
      <div>
        {value}
        {children}
      </div>
    );
  }
  Radio.Card = RadioCard;

  function List({ children }: { children?: ReactNode }) {
    return <ul>{children}</ul>;
  }
  function ListItem({ children }: { children?: ReactNode }) {
    return <li>{children}</li>;
  }
  List.Item = ListItem;

  return {
    Alert: passthrough,
    Anchor: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
    Box: passthrough,
    Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    Checkbox,
    Divider: () => <hr />,
    Flex: passthrough,
    FocusTrap: passthrough,
    Group: passthrough,
    Input,
    List,
    MultiSelect: ({ placeholder }: { placeholder?: string }) => <div>{`multiselect:${placeholder || ''}`}</div>,
    NumberInput: ({ placeholder }: { placeholder?: string }) => <div>{`number:${placeholder || ''}`}</div>,
    Paper: passthrough,
    Radio,
    rem: (v: number) => `${v}px`,
    Select: ({ placeholder }: { placeholder?: string }) => <div>{`select:${placeholder || ''}`}</div>,
    Slider: () => <div>slider</div>,
    Stack: passthrough,
    Text,
    TextInput: ({ placeholder, value }: { placeholder?: string; value?: string }) => <div>{`text:${placeholder || ''}:${value || ''}`}</div>,
    Textarea: ({ placeholder, value }: { placeholder?: string; value?: string }) => <div>{`textarea:${placeholder || ''}:${value || ''}`}</div>,
    Tooltip: ({ children, label }: { children?: ReactNode; label?: string }) => (
      <span>
        {label}
        {children}
      </span>
    ),
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => <span>info-icon</span>,
}));

vi.mock('../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ funcIndex: undefined }),
  useSearchParams: () => [new URLSearchParams('captured=query-value')],
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: () => 0,
  useCurrentIdentifier: () => 'comp-1_0',
}));

vi.mock('../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../utils/fetchStylesheet', () => ({
  useFetchStylesheet: vi.fn(),
}));

vi.mock('../../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: (sequence: { components: string[] }) => sequence.components,
}));

vi.mock('../../store/store', () => ({
  useStoreDispatch: () => mockDispatch,
  useStoreSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  useStoreActions: () => ({
    toggleShowHelpText: () => ({ type: 'help/toggle' }),
    incrementHelpCounter: (payload: unknown) => ({ type: 'help/increment', payload }),
    setMatrixAnswersRadio: (payload: unknown) => ({ type: 'matrix/radio', payload }),
    setMatrixAnswersCheckbox: (payload: unknown) => ({ type: 'matrix/checkbox', payload }),
    setRankingAnswers: (payload: unknown) => ({ type: 'ranking/set', payload }),
    updateResponseBlockValidation: (payload: unknown) => ({ type: 'validation/update', payload }),
    saveIncorrectAnswer: (payload: unknown) => ({ type: 'answer/incorrect', payload }),
  }),
}));

vi.mock('../NextButton', () => ({
  NextButton: ({ label }: { label: string }) => <div>{`next-button:${label}`}</div>,
}));

vi.mock('@trrack/core', () => ({
  initializeTrrack: vi.fn(() => ({
    apply: vi.fn(),
    graph: { backend: {} },
  })),
  Registry: {
    create: vi.fn(() => ({
      register: vi.fn((_name: string, _fn: unknown) => vi.fn((payload: unknown) => payload)),
    })),
  },
}));

describe('ResponseInput consolidated coverage', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockNavigate.mockReset();
    mockStoredAnswer = {
      optionOrders: {},
      questionOrders: {},
      formOrder: {},
    };
    mockState = {
      sequence: { components: ['comp-1', 'comp-2'] },
      completed: false,
      analysisProvState: {
        belowStimulus: undefined,
        sidebar: undefined,
        stimulus: undefined,
      },
      reactiveAnswers: {},
      matrixAnswers: {},
      rankingAnswers: {},
      trialValidation: {},
    };
    mockStudyConfig = {
      components: {
        'comp-1': { previousButton: false },
        'comp-2': { previousButton: true },
      },
      uiConfig: {
        enumerateQuestions: true,
        responseDividers: false,
        provideFeedback: false,
        allowFailedTraining: true,
        trainingAttempts: 2,
        nextButtonLocation: 'belowStimulus',
        nextButtonText: 'Next',
        nextOnEnter: false,
      },
    };
  });

  it('renders core input components', () => {
    const buttons = renderToStaticMarkup(
      <ButtonsInput
        response={{
          id: 'btn', prompt: 'Choose', options: ['A', 'B'], type: 'buttons', required: true,
        } as never}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(buttons).toContain('Choose');
    expect(buttons).toContain('A');

    const checkbox = renderToStaticMarkup(
      <CheckBoxInput
        response={{
          id: 'cb',
          type: 'checkbox',
          prompt: 'Pick',
          options: ['X', 'Y'],
          withOther: true,
          horizontal: false,
        } as never}
        disabled={false}
        answer={{ value: ['X'] }}
        index={1}
        enumerateQuestions
        otherValue={{ value: 'other' }}
      />,
    );
    expect(checkbox).toContain('Pick');
    expect(checkbox).toContain('Other');

    const numeric = renderToStaticMarkup(
      <NumericInput
        response={{
          id: 'n1', type: 'numerical', prompt: 'Number', placeholder: 'enter',
        } as never}
        disabled={false}
        answer={{ value: 3 }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(numeric).toContain('number:enter');
  });

  it('renders dropdown, radio, likert, slider and text inputs', () => {
    const dropdownSingle = renderToStaticMarkup(
      <DropdownInput
        response={{
          id: 'd1', type: 'dropdown', prompt: 'Drop', options: ['A', 'B'], placeholder: 'pick',
        } as never}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(dropdownSingle).toContain('select:pick');

    const dropdownMulti = renderToStaticMarkup(
      <DropdownInput
        response={{
          id: 'd2',
          type: 'dropdown',
          prompt: 'Drop Multi',
          options: ['A', 'B'],
          placeholder: 'pick',
          minSelections: 1,
          maxSelections: 2,
        } as never}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(dropdownMulti).toContain('multiselect:pick');

    const radio = renderToStaticMarkup(
      <RadioInput
        response={{
          id: 'r1',
          type: 'radio',
          prompt: 'Radio',
          options: ['L', 'R'],
          horizontal: true,
          leftLabel: 'Low',
          rightLabel: 'High',
          withOther: true,
        } as never}
        disabled={false}
        answer={{ value: '' }}
        index={2}
        enumerateQuestions
      />,
    );
    expect(radio).toContain('Radio');
    expect(radio).toContain('Low');

    const likert = renderToStaticMarkup(
      <LikertInput
        response={{
          id: 'lik', type: 'likert', prompt: 'Likert', numItems: 5,
        } as never}
        disabled={false}
        answer={{ value: '' }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(likert).toContain('Likert');
    expect(likert).toContain('5');

    const slider = renderToStaticMarkup(
      <SliderInput
        response={{
          id: 's1',
          type: 'slider',
          prompt: 'Slide',
          options: [{ value: 0, label: 'low' }, { value: 10, label: 'high' }],
        } as never}
        disabled={false}
        answer={{ value: 5 }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(slider).toContain('slider');

    const sliderSmeq = renderToStaticMarkup(
      <SliderInput
        response={{
          id: 's2',
          type: 'slider',
          prompt: 'Slide SMEQ',
          smeqStyle: true,
          options: [{ value: 0, label: '' }, { value: 100, label: 'max' }],
        } as never}
        disabled={false}
        answer={{ value: 50 }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(sliderSmeq).toContain('Slide SMEQ');

    const str = renderToStaticMarkup(
      <StringInput
        response={{
          id: 't1', type: 'shortText', prompt: 'Short', placeholder: 'short...',
        } as never}
        disabled={false}
        answer={{ value: 'abc' }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(str).toContain('text:short...:abc');

    const textArea = renderToStaticMarkup(
      <TextAreaInput
        response={{
          id: 'ta1', type: 'longText', prompt: 'Long', placeholder: 'long...',
        } as never}
        disabled={false}
        answer={{ value: 'body' }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(textArea).toContain('textarea:long...:body');
  });

  it('renders helper components and feedback alert interaction text', () => {
    const horizontal = renderToStaticMarkup(
      <HorizontalHandler horizontal style={{}}>
        <span>child</span>
      </HorizontalHandler>,
    );
    expect(horizontal).toContain('child');

    const label = renderToStaticMarkup(
      <InputLabel
        prompt="Prompt text"
        required
        index={3}
        enumerateQuestions
        infoText="Info"
      />,
    );
    expect(label).toContain('3.');
    expect(label).toContain('Info');

    const option = renderToStaticMarkup(<OptionLabel label="Option text" infoText="Opt info" button />);
    expect(option).toContain('Option text');

    const feedback = renderToStaticMarkup(
      <FeedbackAlert
        response={{ id: 'fb1', type: 'shortText' } as never}
        correctAnswer="42"
        alertConfig={{
          fb1: {
            visible: true,
            title: 'Incorrect',
            message: 'Please try again now.',
            color: 'red',
          },
        }}
        identifier="comp-1_0"
        attemptsUsed={2}
        trainingAttempts={2}
      />,
    );
    expect(feedback).toContain('review the help text');
    expect(feedback).toContain('The correct answer was: 42');
  });

  it('renders matrix, ranking, reactive and text-only response views', () => {
    mockStoredAnswer = {
      optionOrders: {},
      questionOrders: { m1: ['q1', 'q2'] },
      formOrder: {},
    };

    const matrix = renderToStaticMarkup(
      <MatrixInput
        response={{
          id: 'm1',
          type: 'matrix-radio',
          prompt: 'Matrix',
          answerOptions: ['No', 'Yes'],
          questionOptions: ['q1', 'q2'],
        } as never}
        answer={{ value: { q1: '', q2: '' } }}
        index={1}
        disabled={false}
        enumerateQuestions
      />,
    );
    expect(matrix).toContain('Matrix');
    expect(matrix).toContain('q1');

    const rankingSublist = renderToStaticMarkup(
      <RankingInput
        response={{
          id: 'rk1', type: 'ranking-sublist', prompt: 'Rank', options: ['A', 'B'],
        } as never}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions
      />,
    );
    expect(rankingSublist).toContain('Available Items');

    const rankingCategorical = renderToStaticMarkup(
      <RankingInput
        response={{
          id: 'rk2', type: 'ranking-categorical', prompt: 'Rank Cat', options: ['A', 'B'],
        } as never}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions
      />,
    );
    expect(rankingCategorical).toContain('HIGH');

    const rankingPairwise = renderToStaticMarkup(
      <RankingInput
        response={{
          id: 'rk3', type: 'ranking-pairwise', prompt: 'Rank Pair', options: ['A', 'B'],
        } as never}
        answer={{ value: {} }}
        index={1}
        disabled={false}
        enumerateQuestions
      />,
    );
    expect(rankingPairwise).toContain('Add New Pair');

    const reactive = renderToStaticMarkup(
      <ReactiveInput
        response={{ id: 're1', type: 'reactive', prompt: 'Reactive' } as never}
        answer={{ value: ['k1', 'k2'] }}
        index={1}
        enumerateQuestions
      />,
    );
    expect(reactive).toContain('k1');

    const textOnly = renderToStaticMarkup(
      <TextOnlyInput response={{ id: 'txt', type: 'textOnly', prompt: 'Read only text' } as never} />,
    );
    expect(textOnly).toContain('Read only text');
  });

  it('renders ResponseSwitcher and ResponseBlock', () => {
    const switcher = renderToStaticMarkup(
      <ResponseSwitcher
        response={{
          id: 'sw1',
          type: 'numerical',
          prompt: 'Switch numeric',
          withDontKnow: true,
          withDivider: true,
          paramCapture: 'captured',
        } as never}
        form={{ value: 3, onChange: vi.fn() }}
        storedAnswer={{} as never}
        index={1}
        config={{ id: 'comp-1' } as never}
        dontKnowCheckbox={{ checked: false, onChange: vi.fn() }}
        otherInput={{ value: '', onChange: vi.fn() }}
      />,
    );
    expect(switcher).toContain('number:');
    expect(switcher).toContain('I don&#x27;t know');

    mockStoredAnswer = {
      optionOrders: {},
      questionOrders: {},
      formOrder: { response: ['rb1'] },
    };

    const block = renderToStaticMarkup(
      <ResponseBlock
        config={{
          id: 'comp-1',
          response: [{
            id: 'rb1', type: 'shortText', prompt: 'Block Q', location: 'belowStimulus',
          }],
          nextButtonLocation: 'belowStimulus',
        } as never}
        location="belowStimulus"
      />,
    );
    expect(block).toContain('text::');
    expect(block).toContain('next-button:Next');
  });
});
