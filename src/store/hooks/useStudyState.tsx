import {
  createContext, Dispatch, SetStateAction, useContext, useLayoutEffect, useState,
} from 'react';
import type { Trrack } from '@trrack/core';
import type { StoredAnswer } from '../types';

interface StudyStateRegistration {
  answers: StoredAnswer['answer'];
  register: (kind: 'state' | 'stateless') => () => void;
}
export const StudyStateContext = createContext<StudyStateRegistration | null>(null);

type RestoreCallback<State> = { onRestore?: (state: State) => void | (() => void) };
type TrackedOptions<State, Event extends string> = RestoreCallback<State> & { trrack: Trrack<State, Event> };
type AnswerOptions<State> = RestoreCallback<State> & { responseId: string; initialState: State };

/** Render the imported graph's current state; subsequent Trrack actions update it. */
export function useStudyState<State, Event extends string>(options: TrackedOptions<State, Event>): State;
/** Restore an answer-only component using its existing response key. Publish edits with setAnswer. */
export function useStudyState<State>(options: AnswerOptions<State>): [State, Dispatch<SetStateAction<State>>];
export function useStudyState<State, Event extends string>(options: TrackedOptions<State, Event> | AnswerOptions<State>) {
  const context = useContext(StudyStateContext);
  const trrack = 'trrack' in options ? options.trrack : undefined;
  const [state, setState] = useState<State>(() => {
    if (trrack) return trrack.getState();
    const answerOptions = options as AnswerOptions<State>;
    return context && Object.hasOwn(context.answers, answerOptions.responseId)
      ? context.answers[answerOptions.responseId] as State : answerOptions.initialState;
  });
  // Callback is a mount-time restoration, not a reaction to its function identity.
  const [onRestore] = useState(() => options.onRestore);
  useLayoutEffect(() => context?.register('state'), [context]);
  useLayoutEffect(() => {
    const unsubscribe = trrack?.currentChange(() => setState(trrack.getState()));
    const cleanup = onRestore?.(trrack ? trrack.getState() : state);
    return () => { unsubscribe?.(); cleanup?.(); };
    // State is initialized once for this component's trial/mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trrack, onRestore]);
  return trrack ? state : [state, setState];
}

/** Explicitly opt out of component-state restoration for a stateless stimulus. */
export function useStatelessStudyComponent() {
  const context = useContext(StudyStateContext);
  useLayoutEffect(() => context?.register('stateless'), [context]);
}
