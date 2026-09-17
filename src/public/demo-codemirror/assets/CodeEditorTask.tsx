import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Alert, Badge, Button, Code, Group, List, ScrollArea, Stack, Text,
} from '@mantine/core';
import { EditorState } from '@codemirror/state';
import {
  EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting,
} from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { StimulusParams } from '../../../store/types';
import {
  CodeProvenanceState,
  EMPTY_SELECTION,
  InputEntry,
  createCodeProvenance,
  entryLabel,
  formatEntry,
  replayTo,
  replayableEditor,
  setReplayMode,
  trrackCodeMirror,
} from './trrackCodeMirror';

/** A single input/output pair the participant's function has to satisfy. */
interface TestCase {
  args: unknown[];
  expected: unknown;
}

/** Trial parameters supplied by the study config. */
interface CodeEditorParams {
  /** Code the editor is seeded with. Contains the bug the participant has to find. */
  starterCode: string;
  /** Name of the function the test runner should pull out of the participant's code. */
  functionName: string;
  /** Cases the participant's function is checked against when they press "Run tests". */
  testCases: TestCase[];
}

/** The outcome of running one test case against the participant's code. */
interface TestResult {
  label: string;
  passed: boolean;
  actual: string;
}

/** Outcome of one press of "Run tests". */
interface TestRun {
  results: TestResult[];
  runtimeError: string | null;
}

/** The editor provenance plus this task's own test-running state. */
interface CodeEditorState extends CodeProvenanceState {
  results: TestResult[];
  runtimeError: string | null;
  runCount: number;
}

/** How many of the most recent entries the on-screen log shows. */
const VISIBLE_LOG_ENTRIES = 8;

const describe = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

const testLabel = (functionName: string, { args, expected }: TestCase) => `${functionName}(${args.map(describe).join(', ')}) → ${describe(expected)}`;

/**
 * Evaluate the participant's source in an isolated function scope, pull out the
 * function under test, and run every case against it.
 *
 * Participant code runs on the main thread, so an accidental infinite loop will
 * freeze the tab. That is acceptable for a short demo task; a production study
 * would run this in a Web Worker it can terminate.
 */
function runTestCases(
  source: string,
  functionName: string,
  testCases: TestCase[],
): TestRun {
  // `new Function` compiles eagerly, so a syntax error surfaces here rather
  // than when the factory is invoked below.
  let factory: () => unknown;
  try {
    // eslint-disable-next-line no-new-func
    factory = new Function(`"use strict";\n${source}\n;return typeof ${functionName} === "function" ? ${functionName} : undefined;`) as () => unknown;
  } catch (error) {
    return { results: [], runtimeError: `Your code has a syntax error: ${(error as Error).message}` };
  }

  let candidate: unknown;
  try {
    candidate = factory();
  } catch (error) {
    return { results: [], runtimeError: `Your code threw before any test ran: ${(error as Error).message}` };
  }

  if (typeof candidate !== 'function') {
    return { results: [], runtimeError: `Could not find a function named ${functionName}.` };
  }
  const participantFunction = candidate as (...args: unknown[]) => unknown;

  const results = testCases.map((testCase) => {
    const label = testLabel(functionName, testCase);
    try {
      const actual = participantFunction(...testCase.args);
      return {
        label,
        passed: describe(actual) === describe(testCase.expected),
        actual: describe(actual),
      };
    } catch (error) {
      return { label, passed: false, actual: `threw ${(error as Error).message}` };
    }
  });

  return { results, runtimeError: null };
}

// The editor's own provenance, widened with this task's test-running state so
// an analyst replaying the session sees the results as they stood at each node.
const { registry, recordAction } = createCodeProvenance<CodeEditorState>();

const runTestsAction = registry.register<'runTests', 'undoRunTests', TestRun>(
  'runTests',
  (state: CodeEditorState, run) => {
    state.results = run.results;
    state.runtimeError = run.runtimeError;
    state.runCount += 1;
    return state;
  },
);

function CodeEditorTask({
  parameters, setAnswer, provenanceState, useTrrack,
}: StimulusParams<CodeEditorParams, CodeEditorState>) {
  const { starterCode, functionName, testCases } = parameters;

  const trrack = useTrrack<CodeEditorState>({
    registry,
    initialState: {
      code: starterCode,
      selection: EMPTY_SELECTION,
      inputLog: [],
      results: [],
      runtimeError: null,
      runCount: 0,
    },
  });

  const [code, setCode] = useState(starterCode);
  const [inputLog, setInputLog] = useState<InputEntry[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  const editorParent = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // The editor is created once, so the recorder reaches the current handler
  // through a ref rather than by rebuilding extensions on every render.
  const onEntryRef = useRef<(entry: InputEntry) => void>(() => {});
  onEntryRef.current = useCallback((entry: InputEntry) => {
    setInputLog((previous) => [...previous, entry]);
    if (entry.kind === 'edit') {
      setCode(viewRef.current?.state.doc.toString() ?? '');
    }
    trrack.apply(entryLabel(entry), recordAction({
      entries: [entry],
      code: entry.kind === 'edit' ? viewRef.current?.state.doc.toString() : undefined,
    }));
  }, [trrack]);

  useEffect(() => {
    const parent = editorParent.current;
    if (!parent) {
      return undefined;
    }

    const mountedAt = Date.now();
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: starterCode,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          // Draws CodeMirror's own selection layer, so a replayed selection is
          // still visible in an editor that isn't focused.
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          javascript(),
          replayableEditor(),
          trrackCodeMirror({
            onEntry: (entry) => onEntryRef.current(entry),
            // Timestamps are relative to the editor mounting, so they stay
            // comparable across participants without leaking wall-clock time.
            now: () => Date.now() - mountedAt,
          }),
          EditorView.theme({
            '&': {
              height: '320px',
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: '4px',
            },
            '.cm-scroller': { overflow: 'auto' },
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [starterCode]);

  const handleReset = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      // Dispatched as ordinary input, so the recorder logs the reset the same
      // way it logs any other document change.
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: starterCode },
        userEvent: 'reset',
      });
    }
  }, [starterCode]);

  const handleRun = useCallback(() => {
    const run = runTestCases(code, functionName, testCases);
    setResults(run.results);
    setRuntimeError(run.runtimeError);
    setRunCount((previous) => previous + 1);
    trrack.apply('Run tests', runTestsAction(run));
  }, [code, functionName, testCases, trrack]);

  // Report answers continuously rather than only on a run, so a participant who
  // keeps editing after their last run still has their final code recorded.
  useEffect(() => {
    setAnswer({
      // The participant can advance once they have run the tests at least once.
      // Swap this for `results.length > 0 && results.every((r) => r.passed)` to
      // require a correct solution before the next button unlocks.
      status: runCount > 0,
      answers: {
        solution: code,
        testResults: runtimeError
          ? [runtimeError]
          : results.map((result) => `${result.passed ? 'PASS' : 'FAIL'}  ${result.label}${result.passed ? '' : ` (got ${result.actual})`}`),
        runCount,
        // The full log lives in the provenance graph, one node per entry. The
        // count is surfaced as an answer so it is available without replaying.
        inputEvents: inputLog.length,
      },
    });
  }, [code, inputLog.length, results, runCount, runtimeError, setAnswer]);

  // Replay: drive the editor to whatever node the analyst has seeked to, and
  // lock it so their typing can't disturb the participant's session.
  const isReplay = provenanceState !== undefined;
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    setReplayMode(view, isReplay);
  }, [isReplay]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !provenanceState) {
      return;
    }
    replayTo(view, provenanceState);
    setCode(provenanceState.code);
    setInputLog(provenanceState.inputLog);
    setResults(provenanceState.results);
    setRuntimeError(provenanceState.runtimeError);
    setRunCount(provenanceState.runCount);
  }, [provenanceState]);

  const passingCount = results.filter((result) => result.passed).length;
  const recentEntries = inputLog.slice(-VISIBLE_LOG_ENTRIES);

  return (
    <Stack gap="md" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div ref={editorParent} />

      <Group>
        <Button onClick={handleRun} disabled={isReplay}>Run tests</Button>
        <Button
          variant="subtle"
          onClick={handleReset}
          disabled={isReplay || code === starterCode}
        >
          Reset code
        </Button>
        <Badge variant="light" color="gray">{`${inputLog.length} input events`}</Badge>
        {runCount > 0 && !runtimeError && (
          <Badge color={passingCount === results.length ? 'green' : 'red'} variant="light">
            {`${passingCount} / ${results.length} passing`}
          </Badge>
        )}
      </Group>

      {recentEntries.length > 0 && (
        <ScrollArea.Autosize mah={130}>
          <Stack gap={2}>
            {recentEntries.map((entry, index) => (
              <Text
                // Entries are append-only and never reordered, so an entry's
                // position in the log is a stable key.
                // eslint-disable-next-line react/no-array-index-key
                key={`${inputLog.length - recentEntries.length + index}`}
                size="xs"
                c="dimmed"
                ff="monospace"
              >
                {formatEntry(entry)}
              </Text>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      {runtimeError && (
        <Alert color="red" title="Your code didn't run">
          {runtimeError}
        </Alert>
      )}

      {results.length > 0 && (
        <List spacing="xs" size="sm">
          {results.map((result) => (
            <List.Item key={result.label} c={result.passed ? 'green.8' : 'red.8'}>
              <Code>{result.label}</Code>
              {!result.passed && <Text span size="sm">{` — got ${result.actual}`}</Text>}
            </List.Item>
          ))}
        </List>
      )}
    </Stack>
  );
}

export default CodeEditorTask;
