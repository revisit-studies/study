import { MantineProvider } from '@mantine/core';
import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StudyVisibilityItem } from '../StudyVisibilityItem';
import { showNotification } from '../../../../utils/notifications';

const { getHidden, setHidden } = vi.hoisted(() => ({
  getHidden: vi.fn(),
  setHidden: vi.fn(),
}));

const storageEngine = {
  getStudyHiddenFromLandingPage: getHidden,
  setStudyHiddenFromLandingPage: setHidden,
};

vi.mock('../../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine }),
}));

vi.mock('../../../../utils/notifications', () => ({
  showNotification: vi.fn(),
}));

function visibilityItem(studyId = 'test-study') {
  return <MantineProvider env="test"><StudyVisibilityItem studyId={studyId} /></MantineProvider>;
}

function getSwitch() {
  return screen.getByRole('switch', { name: 'Show study on landing page' }) as HTMLInputElement;
}

describe('StudyVisibilityItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHidden.mockResolvedValue(false);
    setHidden.mockResolvedValue(undefined);
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test.each([false, true])('shows the opposite of the saved hidden setting %s', async (hidden) => {
    getHidden.mockResolvedValue(hidden);
    await act(async () => { render(visibilityItem()); });

    expect(getHidden).toHaveBeenCalledWith('test-study');
    expect(getSwitch().checked).toBe(!hidden);
    expect(getSwitch().disabled).toBe(false);
  });

  test.each([false, true])('renders the saved hidden setting %s without flashing a default toggle', async (hidden) => {
    let resolveVisibility: (hidden: boolean) => void = () => {};
    getHidden.mockReturnValue(new Promise<boolean>((resolve) => { resolveVisibility = resolve; }));
    render(visibilityItem());

    expect(screen.queryByRole('switch', { name: 'Show study on landing page' })).toBeNull();

    await act(async () => { resolveVisibility(hidden); });
    expect(getSwitch().checked).toBe(!hidden);
    expect(getSwitch().disabled).toBe(false);
  });

  test('persists hiding and showing the study only after the save succeeds', async () => {
    await act(async () => { render(visibilityItem()); });
    let finishSave: () => void = () => {};
    setHidden.mockReturnValueOnce(new Promise<void>((resolve) => { finishSave = resolve; }));

    await act(async () => { fireEvent.click(getSwitch()); });
    expect(setHidden).toHaveBeenLastCalledWith('test-study', true);
    expect(getSwitch().checked).toBe(true);
    expect(getSwitch().disabled).toBe(false);

    await act(async () => { fireEvent.click(getSwitch()); });
    expect(setHidden).toHaveBeenCalledTimes(1);

    await act(async () => { finishSave(); });
    expect(getSwitch().checked).toBe(false);
    expect(getSwitch().disabled).toBe(false);

    await act(async () => { fireEvent.click(getSwitch()); });
    expect(setHidden).toHaveBeenLastCalledWith('test-study', false);
    expect(getSwitch().checked).toBe(true);
  });

  test('does not show an unknown setting and reports a failed read', async () => {
    getHidden.mockRejectedValue(new Error('Read failed'));
    await act(async () => { render(visibilityItem()); });

    expect(screen.queryByRole('switch', { name: 'Show study on landing page' })).toBeNull();
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Unable to load study visibility', color: 'red',
    }));
    expect(setHidden).not.toHaveBeenCalled();
  });

  test('preserves the saved value and permits retry after a failed write', async () => {
    getHidden.mockResolvedValue(true);
    setHidden.mockRejectedValueOnce(new Error('Write failed'));
    await act(async () => { render(visibilityItem()); });

    await act(async () => { fireEvent.click(getSwitch()); });
    expect(getSwitch().checked).toBe(false);
    expect(getSwitch().disabled).toBe(false);
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Unable to save study visibility', color: 'red',
    }));

    await act(async () => { fireEvent.click(getSwitch()); });
    expect(setHidden).toHaveBeenLastCalledWith('test-study', false);
    expect(getSwitch().checked).toBe(true);
  });

  test('ignores a previous study read after switching studies', async () => {
    let resolvePrevious: (hidden: boolean) => void = () => {};
    getHidden.mockReturnValueOnce(new Promise<boolean>((resolve) => { resolvePrevious = resolve; }));
    const view = render(visibilityItem('previous-study'));

    await act(async () => { view.rerender(visibilityItem('current-study')); });
    expect(getHidden).toHaveBeenLastCalledWith('current-study');
    await act(async () => { resolvePrevious(true); });

    expect(getSwitch().checked).toBe(true);
    expect(getSwitch().disabled).toBe(false);
  });

  test('ignores a previous study save after switching studies', async () => {
    let finishPreviousSave: () => void = () => {};
    setHidden.mockReturnValueOnce(new Promise<void>((resolve) => { finishPreviousSave = resolve; }));
    const view = await act(async () => render(visibilityItem('previous-study')));
    await act(async () => { fireEvent.click(getSwitch()); });

    await act(async () => { view.rerender(visibilityItem('current-study')); });
    await act(async () => { finishPreviousSave(); });

    expect(getSwitch().checked).toBe(true);
    expect(getSwitch().disabled).toBe(false);
  });
});
