import { cleanup, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { RestorationWarning } from '../RestorationWarning';
import { startDesignerPreview } from '../../../store/hooks/useDesignerPreview';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

vi.mock('../../../routes/utils', () => ({ useStudyId: () => 'study' }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
function mount(url: string, visible = true) {
  return render(<MemoryRouter initialEntries={[url]}><MantineProvider forceColorScheme="light"><RestorationWarning component="trial_1" visible={visible} /></MantineProvider></MemoryRouter>);
}

test('requires explicit preview entry as well as its session context', () => {
  let view = mount('/study?preview=true');
  expect(screen.queryByRole('alert')).toBeNull();
  view.unmount();
  startDesignerPreview('study');
  view = mount('/study');
  expect(screen.queryByRole('alert')).toBeNull();
  view.unmount();
  mount('/study?preview=true');
  expect(screen.getByRole('alert').textContent).toContain('trial_1');
  expect(screen.getByRole('alert').textContent).toContain('useStudyState');
});

test.each(['/study?preview=true&participantId=person', '/study'])('never warns in analysis or participant entry: %s', (url) => {
  startDesignerPreview('study');
  mount(url);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('suppresses diagnostics while loading or after support registers', () => {
  startDesignerPreview('study');
  mount('/study?preview=true', false);
  expect(screen.queryByRole('alert')).toBeNull();
});
