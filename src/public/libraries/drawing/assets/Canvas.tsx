import {
  ActionIcon, Box, Button, ColorSwatch, Group, SegmentedControl, Stack, Tooltip,
} from '@mantine/core';
import {
  IconArrowBackUp, IconArrowForwardUp, IconCircleFilled, IconEraser, IconPencil,
} from '@tabler/icons-react';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import throttle from 'lodash.throttle';
import { StimulusParams } from '../../../../store/types';
import { useIsAnalysis } from '../../../../store/hooks/useIsAnalysis';
import {
  DRAWING_COLORS, DrawingParameters, DrawingScene, DrawingState, DrawingTool, emptyDrawing, hasDrawing,
} from './types';
import { toDrawingScene } from './legacy';
import { drawingHistory, drawingProvenance } from './provenance';
import DrawingEditor from './DrawingEditor';

export default function Canvas({
  parameters = {}, provenanceState, setAnswer, useTrrack,
}: StimulusParams<DrawingParameters, DrawingState>) {
  const isAnalysis = useIsAnalysis();
  const readOnly = isAnalysis || provenanceState !== undefined;
  const [definition] = useState(() => drawingProvenance(parameters));
  const trrack = useTrrack({ registry: definition.registry, initialState: definition.initialState });
  const [controls, setControls] = useState(definition.initialState);
  const [initialScene] = useState(() => toDrawingScene(parameters.initialDrawing ?? null));
  const [restoreScene, setRestoreScene] = useState<DrawingScene | undefined>(undefined);
  const [history] = useState(() => drawingHistory(initialScene));
  const [, refreshHistory] = useState(0);
  const currentScene = useRef(initialScene);
  const responseId = parameters.responseId ?? 'drawing';
  const requireDrawing = parameters.requireDrawing ?? false;

  const publishAnswer = useCallback((scene: DrawingScene) => {
    if (readOnly) return;
    // Excalidraw types contain optional undefined fields; strip them before
    // publishing the final scene as reVISit's JSON-valued response.
    setAnswer({ status: !requireDrawing || hasDrawing(scene), answers: { [responseId]: JSON.parse(JSON.stringify(scene)) } });
  }, [readOnly, requireDrawing, responseId, setAnswer]);

  useEffect(() => { publishAnswer(currentScene.current); }, [publishAnswer]);

  const recordScene = useMemo(() => throttle((scene: DrawingScene) => {
    trrack.apply('drawing', definition.actions.scene(scene));
    publishAnswer(scene);
  }, 100), [trrack, definition, publishAnswer]);
  useEffect(() => () => { recordScene.flush(); recordScene.cancel(); }, [recordScene]);

  const onChange = (scene: DrawingScene) => {
    if (readOnly) return;
    currentScene.current = scene;
    setRestoreScene(undefined);
    recordScene(scene);
  };
  const onCommit = (scene: DrawingScene) => {
    if (readOnly) return;
    currentScene.current = scene;
    recordScene.flush();
    history.commit(scene);
    // The last point may arrive after the last throttled update.
    trrack.apply('drawEnd', definition.actions.scene(scene));
    publishAnswer(scene);
    refreshHistory((value) => value + 1);
  };
  const changeTool = (tool: string) => {
    if (readOnly || (tool !== 'pen' && tool !== 'eraser')) return;
    recordScene.flush();
    setControls((previous) => ({ ...previous, tool }));
    trrack.apply('Set Tool', definition.actions.tool(tool));
  };
  const restore = (scene: DrawingScene, label: string) => {
    recordScene.flush();
    currentScene.current = scene;
    setRestoreScene(scene);
    trrack.apply(label, definition.actions.scene(scene));
    publishAnswer(scene);
    refreshHistory((value) => value + 1);
  };
  const undo = () => {
    if (readOnly) return;
    recordScene.flush();
    const scene = history.undo();
    if (scene) restore(scene, 'undo');
  };
  const redo = () => {
    if (readOnly) return;
    recordScene.flush();
    const scene = history.redo();
    if (scene) restore(scene, 'redo');
  };

  const displayed = provenanceState ?? controls;
  return (
    <Stack
      className="revisit-drawing"
      data-fill-available={parameters.height === undefined || undefined}
      style={{ flexGrow: 1, minHeight: 0 }}
      gap="sm"
      onKeyDownCapture={(event) => {
        if (readOnly) return;
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
          event.preventDefault(); event.stopPropagation();
          if (key === 'y' || event.shiftKey) redo(); else undo();
        } else if (
          ['escape', 'delete', 'backspace'].includes(key)
          || (!(event.ctrlKey || event.metaKey) && /^[a-z0-9]$/.test(key))
          || ((event.ctrlKey || event.metaKey) && ['a', 'd', 'x', 'v'].includes(key))
        ) {
          // Native selection/editing bypasses the study's tools and gesture history.
          event.preventDefault(); event.stopPropagation();
          if (!event.ctrlKey && !event.metaKey) {
            if (key === 'e') changeTool('eraser');
            if (key === 'p' || key === 'd') changeTool('pen');
          }
        }
      }}
    >
      <Group gap="sm" aria-label="Drawing controls">
        <SegmentedControl
          aria-label="Drawing tool"
          value={displayed.tool}
          disabled={readOnly}
          data={[
            { label: <IconPencil size={18} aria-label="Pen" />, value: 'pen' },
            { label: <IconEraser size={18} aria-label="Eraser" />, value: 'eraser' },
          ]}
          onChange={changeTool}
        />
        <SegmentedControl
          aria-label="Pen size"
          value={displayed.penSize}
          disabled={readOnly}
          data={[
            { label: <IconCircleFilled size={8} aria-label="Medium" />, value: 'm' },
            { label: <IconCircleFilled size={12} aria-label="Large" />, value: 'l' },
            { label: <IconCircleFilled size={16} aria-label="Extra large" />, value: 'xl' },
          ]}
          onChange={(penSize) => {
            recordScene.flush();
            setControls((previous) => ({ ...previous, penSize }));
            trrack.apply('Change Pen Size', definition.actions.penSize(penSize));
          }}
        />
        <Group gap={6}>
          {Object.entries(DRAWING_COLORS).map(([name, color]) => (
            <ColorSwatch
              key={name}
              component="button"
              type="button"
              aria-label={`Use ${name} ink`}
              aria-pressed={displayed.color === name}
              disabled={readOnly}
              color={color}
              style={{ outline: displayed.color === name ? '2px solid currentColor' : undefined, outlineOffset: 2, cursor: readOnly ? 'default' : 'pointer' }}
              onClick={() => {
                recordScene.flush();
                setControls((previous) => ({ ...previous, color: name }));
                trrack.apply('Change Color', definition.actions.color(name));
              }}
            />
          ))}
        </Group>
        <Button
          disabled={readOnly}
          onClick={() => {
            const scene = emptyDrawing();
            history.commit(scene);
            restore(scene, 'clearing');
          }}
        >
          Clear all
        </Button>
        <Tooltip label="Undo"><ActionIcon aria-label="Undo drawing" disabled={readOnly || !history.canUndo} onClick={undo}><IconArrowBackUp /></ActionIcon></Tooltip>
        <Tooltip label="Redo"><ActionIcon aria-label="Redo drawing" disabled={readOnly || !history.canRedo} onClick={redo}><IconArrowForwardUp /></ActionIcon></Tooltip>
      </Group>
      <Box className="revisit-drawing-surface" h={parameters.height} style={{ minHeight: 200, flex: parameters.height === undefined ? '1 1 0px' : '0 0 auto' }}>
        <DrawingEditor
          initialDrawing={parameters.initialDrawing}
          snapshot={readOnly ? provenanceState?.state ?? null : restoreScene}
          readOnly={readOnly}
          color={displayed.color}
          tool={displayed.tool as DrawingTool}
          penSize={displayed.penSize}
          onChange={onChange}
          onCommit={onCommit}
        />
      </Box>
    </Stack>
  );
}
