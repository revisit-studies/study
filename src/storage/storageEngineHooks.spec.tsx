import {
  render, screen, act, cleanup,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test,
} from 'vitest';
import { StorageEngineProvider, useStorageEngine } from './storageEngineHooks';
import type { StorageEngine } from './engines/types';

// ── helpers ───────────────────────────────────────────────────────────────────

const fakeEngine = { getEngine: () => 'localStorage' } as unknown as StorageEngine;

function EngineConsumer() {
  const { storageEngine, setStorageEngine } = useStorageEngine();
  return (
    <div>
      <div data-testid="status">{storageEngine ? 'set' : 'unset'}</div>
      <button
        type="button"
        data-testid="set-btn"
        onClick={() => setStorageEngine(fakeEngine)}
      >
        Set Engine
      </button>
    </div>
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StorageEngineProvider', () => {
  afterEach(() => cleanup());

  test('provides undefined storageEngine by default', () => {
    render(
      <StorageEngineProvider>
        <EngineConsumer />
      </StorageEngineProvider>,
    );
    expect(screen.getByTestId('status').textContent).toBe('unset');
  });

  test('updates storageEngine when setStorageEngine is called', async () => {
    render(
      <StorageEngineProvider>
        <EngineConsumer />
      </StorageEngineProvider>,
    );
    await act(async () => {
      screen.getByTestId('set-btn').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('set');
  });

  test('renders children inside provider', () => {
    render(
      <StorageEngineProvider>
        <span data-testid="child">hello</span>
      </StorageEngineProvider>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });
});
