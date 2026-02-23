import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { download } from '../../components/downloader/DownloadTidy';

const studyId = 'test-study-data-management';

describe('analysis data management tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('download helper supports participant data JSON and tidy CSV filenames', () => {
    const anchor = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const createElement = vi.fn().mockReturnValue(anchor);
    const appendChild = vi.fn().mockReturnValue(anchor as unknown as Node);
    vi.stubGlobal('document', {
      createElement,
      body: {
        appendChild,
      },
    });

    download('{"participantId":"p1"}', `${studyId}_all.json`);
    expect(anchor.setAttribute).toHaveBeenCalledWith('download', `${studyId}_all.json`);
    expect(anchor.click).toHaveBeenCalled();

    download('participantId,trialId\np1,t1', `${studyId}_all_tidy.csv`);
    expect(anchor.setAttribute).toHaveBeenCalledWith('download', `${studyId}_all_tidy.csv`);
    expect(anchor.click).toHaveBeenCalledTimes(2);
  });
});
