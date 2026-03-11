import {
  describe, expect, it, vi,
} from 'vitest';
import { showNotification } from './notifications';

const showMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (input: object) => showMock(input),
  },
}));

describe('showNotification', () => {
  it('uses blue and auto-close defaults when color is not provided', () => {
    showNotification({
      title: 'Saved',
      message: 'All changes saved',
    });

    expect(showMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Saved',
      message: 'All changes saved',
      color: 'blue',
      autoClose: 5000,
      position: 'top-center',
    }));
  });

  it('does not auto-close for red notifications', () => {
    showNotification({
      title: 'Error',
      message: 'Something failed',
      color: 'red',
    });

    expect(showMock).toHaveBeenCalledWith(expect.objectContaining({
      color: 'red',
      autoClose: false,
    }));
  });

  it('does not auto-close for yellow notifications', () => {
    showNotification({
      title: 'Warning',
      message: 'Check this',
      color: 'yellow',
    });

    expect(showMock).toHaveBeenCalledWith(expect.objectContaining({
      color: 'yellow',
      autoClose: false,
    }));
  });
});
