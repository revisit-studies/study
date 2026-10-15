import type { ComponentProps } from 'react';
import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import Canvas from '../Canvas';
import type DrawingEditor from '../DrawingEditor';
import { RevisitProvenanceProvider } from '../../../../../store/hooks/useRevisitTrrack';
import { DrawingParameters, DrawingState, emptyDrawing } from '../types';
import { sceneWithStroke } from './fixtures';

type EditorProps = ComponentProps<typeof DrawingEditor>;
const editor = vi.hoisted(() => ({ props: null as EditorProps | null }));
vi.mock('../DrawingEditor', () => ({
  default: (props: EditorProps) => { editor.props = props; return <div data-testid="mock-drawing-editor" />; },
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}

    unobserve() {}

    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(parameters: DrawingParameters = {}, provenanceState?: DrawingState, route = '/') {
  const setAnswer = vi.fn();
  const onProvenanceChange = vi.fn();
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <MantineProvider>
        <RevisitProvenanceProvider onProvenanceChange={onProvenanceChange}>
          {(useTrrack) => <Canvas parameters={parameters} answers={{}} setAnswer={setAnswer} provenanceState={provenanceState} useTrrack={useTrrack} />}
        </RevisitProvenanceProvider>
      </MantineProvider>
    </MemoryRouter>,
  );
  return { ...result, setAnswer, onProvenanceChange };
}

describe('drawing library Canvas', () => {
  test('publishes a JSON scene under the configured response and validates visible ink', () => {
    const { setAnswer, onProvenanceChange } = mount({ responseId: 'sketch', requireDrawing: true });
    expect(setAnswer.mock.lastCall?.[0]).toMatchObject({ status: false, answers: { sketch: emptyDrawing() } });
    const scene = sceneWithStroke();
    act(() => { editor.props!.onChange(scene); editor.props!.onCommit(scene); });
    expect(setAnswer.mock.lastCall?.[0]).toEqual({ status: true, answers: { sketch: JSON.parse(JSON.stringify(scene)) } });
    const graph = onProvenanceChange.mock.lastCall?.[0];
    expect(Object.values(graph.nodes).map((node) => (node as { label: string }).label)).toContain('drawEnd');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(setAnswer.mock.lastCall?.[0]).toMatchObject({ status: false, answers: { sketch: emptyDrawing() } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo drawing' }));
    expect(editor.props!.snapshot).toEqual(scene);
    expect(setAnswer.mock.lastCall?.[0].status).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Redo drawing' }));
    expect(editor.props!.snapshot).toEqual(emptyDrawing());
  });

  test('records color and pen settings and respects configurable defaults', () => {
    const { onProvenanceChange } = mount({ initialColor: 'blue', initialPenSize: 'l' });
    expect(editor.props).toMatchObject({ color: 'blue', penSize: 'l', tool: 'pen' });
    fireEvent.click(screen.getByRole('button', { name: 'Use green ink' }));
    expect(editor.props!.color).toBe('green');
    fireEvent.click(screen.getByRole('radio', { name: 'Eraser' }));
    expect(editor.props!.tool).toBe('eraser');
    fireEvent.click(screen.getByRole('radio', { name: 'Extra large' }));
    expect(editor.props!.penSize).toBe('xl');
    const graph = onProvenanceChange.mock.lastCall?.[0];
    expect(Object.values(graph.nodes).map((node) => (node as { label: string }).label)).toEqual(expect.arrayContaining(['Change Color', 'Set Tool', 'Change Pen Size']));
  });

  test('replays a cleared state and tool settings without publishing answers or new drawing nodes', () => {
    const { setAnswer, onProvenanceChange } = mount({}, {
      state: null, tool: 'eraser', color: 'blue', penSize: 'xl',
    }, '/?participantId=fixture');
    expect(editor.props).toMatchObject({
      readOnly: true, snapshot: null, tool: 'eraser', color: 'blue', penSize: 'xl',
    });
    const count = onProvenanceChange.mock.calls.length;
    act(() => { editor.props!.onChange(sceneWithStroke()); editor.props!.onCommit(sceneWithStroke()); });
    expect(setAnswer).not.toHaveBeenCalled();
    expect(onProvenanceChange).toHaveBeenCalledTimes(count);
    expect((screen.getByRole('button', { name: 'Clear all' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('keeps gestures independent between mounts and saves an empty optional drawing', () => {
    const first = mount();
    act(() => { editor.props!.onChange(sceneWithStroke()); editor.props!.onCommit(sceneWithStroke()); });
    first.unmount();
    const second = mount();
    expect(second.setAnswer.mock.lastCall?.[0]).toMatchObject({ status: true, answers: { drawing: emptyDrawing() } });
    expect((screen.getByRole('button', { name: 'Undo drawing' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
