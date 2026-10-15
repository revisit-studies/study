import {
  CaptureUpdateAction, Excalidraw, MainMenu,
} from '@excalidraw/excalidraw';
// The stylesheet is exposed through package exports rather than a physical file.
// eslint-disable-next-line import/no-unresolved
import '@excalidraw/excalidraw/index.css';
import {
  useEffect, useRef, useState,
} from 'react';
import type { SyntheticEvent } from 'react';
import {
  DRAWING_COLORS, DRAWING_WIDTHS, DrawingAPI, DrawingAppState,
  DrawingChangeHandler, DrawingElement, DrawingFiles, DrawingScene, DrawingSnapshot, DrawingTool,
} from './types';
import { toDrawingScene } from './legacy';
import './drawing.css';

function preventNativeEdit(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function captureScene(elements: readonly DrawingElement[], appState: DrawingAppState, files: DrawingFiles): DrawingScene {
  return {
    format: 'excalidraw',
    elements: structuredClone(elements),
    files: structuredClone(files),
    appState: {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: { ...appState.zoom },
      viewBackgroundColor: appState.viewBackgroundColor,
    },
  };
}

export default function DrawingEditor({
  initialDrawing, snapshot, readOnly, color, tool, penSize, onChange, onCommit,
}: {
  initialDrawing?: DrawingSnapshot;
  snapshot?: DrawingSnapshot | null;
  readOnly: boolean;
  color: string;
  tool: DrawingTool;
  penSize: string;
  onChange: (scene: DrawingScene) => void;
  onCommit: (scene: DrawingScene) => void;
}) {
  const [initialData] = useState(() => toDrawingScene(snapshot ?? initialDrawing ?? null));
  const [api, setApi] = useState<DrawingAPI | null>(null);
  const [ready, setReady] = useState(false);
  const restoring = useRef(false);
  const lastScene = useRef('');
  const commitFrame = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (commitFrame.current !== undefined) cancelAnimationFrame(commitFrame.current);
  }, []);

  useEffect(() => {
    if (!api || !ready || snapshot === undefined) return undefined;
    if (commitFrame.current !== undefined) {
      cancelAnimationFrame(commitFrame.current);
      commitFrame.current = undefined;
    }
    const scene = toDrawingScene(snapshot);
    restoring.current = true;
    api.addFiles(Object.values(scene.files));
    api.updateScene({
      elements: structuredClone(scene.elements),
      appState: { ...scene.appState, selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const frame = requestAnimationFrame(() => {
      lastScene.current = JSON.stringify(captureScene(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles()));
      restoring.current = false;
    });
    return () => { cancelAnimationFrame(frame); restoring.current = false; };
  }, [api, ready, snapshot]);

  useEffect(() => {
    if (!api || !ready || readOnly) return;
    api.setActiveTool({ type: tool === 'eraser' ? 'eraser' : 'freedraw' });
    api.updateScene({
      appState: {
        currentItemStrokeColor: DRAWING_COLORS[color] ?? color,
        currentItemStrokeWidth: DRAWING_WIDTHS[penSize] ?? DRAWING_WIDTHS.m,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [api, ready, readOnly, tool, color, penSize]);

  const handleChange: DrawingChangeHandler = (elements, appState, files) => {
    if (!ready) {
      lastScene.current = JSON.stringify(captureScene(elements, appState, files));
      setReady(true);
      return;
    }
    if (readOnly || restoring.current) return;
    const scene = captureScene(elements, appState, files);
    const serialized = JSON.stringify(scene);
    if (serialized === lastScene.current) return;
    lastScene.current = serialized;
    onChange(scene);
  };

  const handlePointerUp = () => {
    if (readOnly || !api) return;
    if (commitFrame.current !== undefined) cancelAnimationFrame(commitFrame.current);
    commitFrame.current = requestAnimationFrame(() => {
      commitFrame.current = undefined;
      onCommit(captureScene(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles()));
    });
  };

  return (
    <div
      className="revisit-drawing-canvas"
      data-testid="drawing-canvas"
      onContextMenuCapture={preventNativeEdit}
      onCutCapture={preventNativeEdit}
      onPasteCapture={preventNativeEdit}
      onDragOverCapture={preventNativeEdit}
      onDropCapture={preventNativeEdit}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={handleChange}
        onPointerUp={handlePointerUp}
        onPaste={() => false}
        viewModeEnabled={readOnly}
        zenModeEnabled
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }}
      >
        <MainMenu />
      </Excalidraw>
    </div>
  );
}
