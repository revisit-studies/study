import { useEffect, useState } from 'react';

export type AutoAdvanceSelection = {
  eventId: number;
  identifier: string;
  responseId: string;
  delay: number;
  selected: boolean;
};

type Listener = (selection: AutoAdvanceSelection) => void;

const listeners = new Set<Listener>();
let nextEventId = 0;

export function publishAutoAdvanceSelection(selection: Omit<AutoAdvanceSelection, 'eventId'>) {
  const event = { ...selection, eventId: nextEventId };
  nextEventId += 1;
  listeners.forEach((listener) => listener(event));
}

export function subscribeToAutoAdvanceSelections(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoAdvanceSelection(
  identifier: string,
  responseIds: string[],
  enabled: boolean,
): AutoAdvanceSelection | undefined {
  const [selection, setSelection] = useState<AutoAdvanceSelection>();

  useEffect(() => {
    setSelection(undefined);
  }, [identifier]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const allowedResponseIds = new Set(responseIds);
    const unsubscribe = subscribeToAutoAdvanceSelections((nextSelection) => {
      if (nextSelection.identifier === identifier && allowedResponseIds.has(nextSelection.responseId)) {
        setSelection(nextSelection);
      }
    });
    return () => unsubscribe();
  }, [enabled, identifier, responseIds]);

  return selection;
}
