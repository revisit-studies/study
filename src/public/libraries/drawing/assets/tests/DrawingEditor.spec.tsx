import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import type { Excalidraw } from '@excalidraw/excalidraw';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import DrawingEditor from '../DrawingEditor';
import {
  DrawingAPI, DrawingAppState, DrawingChangeHandler, DrawingScene, emptyDrawing,
} from '../types';
import { sceneWithStroke } from './fixtures';

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;
const engine = vi.hoisted(() => ({
  props: null as ExcalidrawProps | null,
  api: null as DrawingAPI | null,
  scene: null as DrawingScene | null,
  updates: [] as Array<{ captureUpdate?: string }>,
}));

vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { NEVER: 'NEVER' },
  MainMenu: () => null,
  Excalidraw: (props: ExcalidrawProps) => {
    engine.props = props;
    const { initialData, excalidrawAPI } = props;
    useEffect(() => {
      engine.scene = structuredClone(initialData) as DrawingScene;
      const emit = () => engine.props?.onChange?.(
        engine.scene!.elements as Parameters<DrawingChangeHandler>[0],
        engine.scene!.appState as DrawingAppState,
        engine.scene!.files,
      );
      engine.api = {
        getSceneElementsIncludingDeleted: () => engine.scene!.elements,
        getAppState: () => engine.scene!.appState,
        getFiles: () => engine.scene!.files,
        addFiles: vi.fn(),
        setActiveTool: vi.fn(),
        updateScene: (update: { elements?: DrawingScene['elements']; appState?: DrawingScene['appState']; captureUpdate?: string }) => {
          engine.updates.push(update);
          engine.scene = {
            ...engine.scene!,
            elements: update.elements ?? engine.scene!.elements,
            appState: { ...engine.scene!.appState, ...update.appState },
          };
          emit();
        },
      } as unknown as DrawingAPI;
      excalidrawAPI?.(engine.api);
      emit();
    }, [initialData, excalidrawAPI]);
    return <div data-testid="engine" />;
  },
}));

beforeEach(() => { engine.updates = []; });
afterEach(() => { cleanup(); });

const controls = {
  readOnly: true, color: 'red', tool: 'pen' as const, penSize: 'm',
};

test.each(['contextmenu', 'cut', 'paste', 'dragover', 'drop'])('blocks native %s editing before it reaches the engine', (type) => {
  render(<DrawingEditor {...controls} readOnly={false} onChange={vi.fn()} onCommit={vi.fn()} />);
  const target = screen.getByTestId('engine');
  const nativeEdit = vi.fn();
  target.addEventListener(type, nativeEdit);
  expect(fireEvent(target, new Event(type, { bubbles: true, cancelable: true }))).toBe(false);
  expect(nativeEdit).not.toHaveBeenCalled();
  if (type === 'paste') expect(engine.props!.onPaste?.({ text: 'Native clipboard content' }, null)).toBe(false);
});

test('seeks backward and clears replay scenes without recording restored state', async () => {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const snapshot = sceneWithStroke();
  const before = structuredClone(snapshot);
  const view = render(<DrawingEditor {...controls} snapshot={snapshot} onChange={onChange} onCommit={onCommit} />);
  await waitFor(() => expect(engine.scene?.elements).toHaveLength(1));
  view.rerender(<DrawingEditor {...controls} snapshot={null} onChange={onChange} onCommit={onCommit} />);
  await waitFor(() => expect(engine.scene?.elements).toHaveLength(0));
  view.rerender(<DrawingEditor {...controls} snapshot={snapshot} onChange={onChange} onCommit={onCommit} />);
  await waitFor(() => expect(engine.scene?.elements).toHaveLength(1));
  expect(engine.props?.viewModeEnabled).toBe(true);
  expect(engine.updates.every((update) => update.captureUpdate === 'NEVER')).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  expect(onCommit).not.toHaveBeenCalled();
  expect(snapshot).toEqual(before);
});

test('records native changes and applies the study pen width without exposing built-in persistence', async () => {
  const onChange = vi.fn();
  render(<DrawingEditor {...controls} readOnly={false} onChange={onChange} onCommit={vi.fn()} />);
  await waitFor(() => expect(engine.api?.setActiveTool).toHaveBeenCalledWith({ type: 'freedraw' }));
  expect((engine.scene?.appState as Partial<DrawingAppState>).currentItemStrokeWidth).toBe(4.5 / 4.25);
  const scene = sceneWithStroke();
  act(() => engine.props!.onChange!(
    scene.elements as Parameters<DrawingChangeHandler>[0],
    scene.appState as DrawingAppState,
    scene.files,
  ));
  expect(onChange).toHaveBeenCalledWith(scene);
  expect(localStorage.getItem('drawing')).toBeNull();
});

test('restoring native states neither mutates the archived scene nor captures a new drawing', async () => {
  const scene = sceneWithStroke();
  const before = structuredClone(scene);
  const onChange = vi.fn();
  const view = render(<DrawingEditor {...controls} readOnly={false} onChange={onChange} onCommit={vi.fn()} />);
  await waitFor(() => expect(engine.api).not.toBeNull());
  view.rerender(<DrawingEditor {...controls} readOnly={false} snapshot={scene} onChange={onChange} onCommit={vi.fn()} />);
  await waitFor(() => expect(engine.scene?.elements).toHaveLength(1));
  view.rerender(<DrawingEditor {...controls} readOnly={false} snapshot={emptyDrawing()} onChange={onChange} onCommit={vi.fn()} />);
  await waitFor(() => expect(engine.scene?.elements).toHaveLength(0));
  expect(onChange).not.toHaveBeenCalled();
  expect(scene).toEqual(before);
});
