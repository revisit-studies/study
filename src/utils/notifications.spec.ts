import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { notifications as mantineNotifications } from '@mantine/notifications';
import { showNotification } from './notifications';

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('./notify.module.css', () => ({ default: {} }));

afterEach(() => vi.clearAllMocks());

describe('showNotification', () => {
  test('calls notifications.show with title, message, and default blue color', () => {
    showNotification({ title: 'Info', message: 'Something happened' });
    expect(vi.mocked(mantineNotifications.show)).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Info', message: 'Something happened', color: 'blue' }),
    );
  });

  test('uses the provided color when specified', () => {
    showNotification({ title: 'Success', message: 'Done', color: 'green' });
    expect(vi.mocked(mantineNotifications.show)).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green' }),
    );
  });

  test('never auto-closes red (error) notifications', () => {
    showNotification({ title: 'Error', message: 'Bad', color: 'red' });
    expect(vi.mocked(mantineNotifications.show)).toHaveBeenCalledWith(
      expect.objectContaining({ autoClose: false }),
    );
  });

  test('never auto-closes yellow (warning) notifications', () => {
    showNotification({ title: 'Warning', message: 'Careful', color: 'yellow' });
    expect(vi.mocked(mantineNotifications.show)).toHaveBeenCalledWith(
      expect.objectContaining({ autoClose: false }),
    );
  });

  test('auto-closes blue (info) notifications after 5 seconds', () => {
    showNotification({ title: 'Note', message: 'FYI' });
    expect(vi.mocked(mantineNotifications.show)).toHaveBeenCalledWith(
      expect.objectContaining({ autoClose: 5000 }),
    );
  });

  test('centers notification at the top', () => {
    showNotification({ title: 'T', message: 'M' });
    expect(vi.mocked(mantineNotifications.show)).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'top-center' }),
    );
  });
});
