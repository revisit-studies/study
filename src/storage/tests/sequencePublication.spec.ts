import {
  beforeEach, describe, expect, test,
} from 'vitest';
import { StudyConfig } from '../../parser/types';
import { Sequence } from '../../store/types';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import {
  SequenceBuildRecord, StorageObject, StorageObjectType,
} from '../engines/types';
import { hash } from '../engines/utils/storageEngineHelpers';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';

const config = testConfigSimple as StudyConfig;
const changedConfig = testConfigSimple2 as StudyConfig;

class PublicationTrackingEngine extends LocalStorageEngine {
  static uploadCount = 0;

  private failSequenceUpload = false;

  private holdSequenceUpload = false;

  private uploadStartedResolve: (() => void) | undefined;

  private releaseUploadResolve: (() => void) | undefined;

  private uploadStarted = Promise.resolve();

  private uploadRelease = Promise.resolve();

  private providerTime: number | null = null;

  private failSequenceRead = false;

  failNextSequenceUpload() {
    this.failSequenceUpload = true;
    this.uploadStarted = new Promise((resolve) => {
      this.uploadStartedResolve = resolve;
    });
  }

  holdNextSequenceUpload() {
    this.holdSequenceUpload = true;
    this.uploadStarted = new Promise((resolve) => {
      this.uploadStartedResolve = resolve;
    });
    this.uploadRelease = new Promise((resolve) => {
      this.releaseUploadResolve = resolve;
    });
  }

  waitForSequenceUpload() {
    return this.uploadStarted;
  }

  releaseSequenceUpload() {
    this.releaseUploadResolve?.();
  }

  useProviderTime(now: number) {
    this.providerTime = now;
  }

  failNextSequenceRead() {
    this.failSequenceRead = true;
  }

  getStoredSequenceArray(configHash: string) {
    return this._getFromStorage(`sequenceArrays/${configHash}`, 'sequenceArray');
  }

  protected override async _getSequenceBuildProviderTime() {
    return this.providerTime ?? super._getSequenceBuildProviderTime();
  }

  protected override async _getFromStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    studyId?: string,
  ) {
    if (
      this.failSequenceRead
      && type === 'sequenceArray'
      && prefix.startsWith('sequenceArrays/')
    ) {
      this.failSequenceRead = false;
      throw new Error('transient provider failure');
    }
    return super._getFromStorage(prefix, type, studyId);
  }

  claimSequenceBuild(configHash: string, candidate: SequenceBuildRecord, now: number) {
    return this._claimSequenceBuild(configHash, candidate, now);
  }

  protected override async _pushToStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    objectToUpload: StorageObject<T>,
    options?: { cache?: boolean },
  ) {
    if (type === 'sequenceArray' && prefix.startsWith('sequenceArrays/')) {
      PublicationTrackingEngine.uploadCount += 1;
      this.uploadStartedResolve?.();
      if (this.failSequenceUpload) {
        this.failSequenceUpload = false;
        throw new Error('sequence upload failed');
      }
      if (this.holdSequenceUpload) {
        this.holdSequenceUpload = false;
        await this.uploadRelease;
      }
    }
    await super._pushToStorage(prefix, type, objectToUpload, options);
  }
}

async function initializeEngine(engine: LocalStorageEngine, studyId: string) {
  await engine.connect();
  await engine.initializeStudyDb(studyId);
  await engine.saveConfig(config);
}

describe('sequence artifact publication', () => {
  beforeEach(() => {
    PublicationTrackingEngine.uploadCount = 0;
  });

  test('seeded generation is deterministic', () => {
    expect(generateSequenceArray(config, 'shared-seed'))
      .toEqual(generateSequenceArray(config, 'shared-seed'));
  });

  test('participant startup does not await the canonical artifact upload', async () => {
    const engine = new PublicationTrackingEngine(true);
    await initializeEngine(engine, 'sequence-publication-background');
    const configHash = await hash(JSON.stringify(config));
    engine.holdNextSequenceUpload();

    const sequenceArray = await engine.prepareSequenceArray(config, configHash);
    await engine.waitForSequenceUpload();

    expect(sequenceArray).toHaveLength(config.uiConfig.numSequences ?? 1000);
    engine.releaseSequenceUpload();
  });

  test('concurrent clients derive the same array while only one publishes', async () => {
    const studyId = 'sequence-publication-concurrent';
    const publisher = new PublicationTrackingEngine(true);
    const follower = new PublicationTrackingEngine(true);
    await initializeEngine(publisher, studyId);
    await initializeEngine(follower, studyId);
    const configHash = await hash(JSON.stringify(config));
    publisher.holdNextSequenceUpload();

    const publisherArray = await publisher.prepareSequenceArray(config, configHash);
    await publisher.waitForSequenceUpload();
    const followerArray = await follower.prepareSequenceArray(config, configHash);

    expect(followerArray).toEqual(publisherArray);
    expect(PublicationTrackingEngine.uploadCount).toBe(1);
    publisher.releaseSequenceUpload();
  });

  test('a failed publisher can be replaced without changing the derived array', async () => {
    const studyId = 'sequence-publication-retry';
    const failedPublisher = new PublicationTrackingEngine(true);
    const retryingPublisher = new PublicationTrackingEngine(true);
    await initializeEngine(failedPublisher, studyId);
    await initializeEngine(retryingPublisher, studyId);
    const configHash = await hash(JSON.stringify(config));
    failedPublisher.failNextSequenceUpload();

    const firstArray = await failedPublisher.prepareSequenceArray(config, configHash);
    await failedPublisher.waitForSequenceUpload();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    const retriedArray = await retryingPublisher.prepareSequenceArray(config, configHash);

    expect(retriedArray).toEqual(firstArray);
    expect(PublicationTrackingEngine.uploadCount).toBe(2);
  });

  test('an expired publisher lease can be claimed without changing its seed', async () => {
    const engine = new PublicationTrackingEngine(true);
    await initializeEngine(engine, 'sequence-publication-expired-lease');
    const initialBuild: SequenceBuildRecord = {
      seed: 'persistent-seed',
      algorithmVersion: 1,
      status: 'building',
      publisherId: 'first-publisher',
      leaseExpiresAt: 101,
      attempts: 1,
      updatedAt: 100,
    };
    await engine.claimSequenceBuild('config-hash', initialBuild, 100);

    const replacement = await engine.claimSequenceBuild('config-hash', {
      ...initialBuild,
      seed: 'ignored-new-seed',
      publisherId: 'replacement-publisher',
      leaseExpiresAt: 202,
      updatedAt: 102,
    }, 102);

    expect(replacement.shouldPublish).toBe(true);
    expect(replacement.record.seed).toBe('persistent-seed');
    expect(replacement.record.publisherId).toBe('replacement-publisher');
    expect(replacement.record.attempts).toBe(2);
  });

  test('an existing legacy array remains readable without migration', async () => {
    const studyId = 'sequence-publication-legacy';
    const existingEngine = new PublicationTrackingEngine(true);
    await initializeEngine(existingEngine, studyId);
    const legacyArray = generateSequenceArray(config, 'legacy-seed');
    await existingEngine.setSequenceArray(legacyArray);

    const resumedEngine = new PublicationTrackingEngine(true);
    await initializeEngine(resumedEngine, studyId);
    const configHash = await hash(JSON.stringify(config));
    const resolvedArray = await resumedEngine.prepareSequenceArray(config, configHash);

    expect(resolvedArray).toEqual(legacyArray);
    expect(PublicationTrackingEngine.uploadCount).toBe(0);
  });

  test('does not reuse a legacy array after the config hash changes', async () => {
    const engine = new PublicationTrackingEngine(true);
    await initializeEngine(engine, 'sequence-publication-legacy-transition');
    const legacyArray = generateSequenceArray(config, 'legacy-seed');
    await engine.setSequenceArray(legacyArray);
    await engine.saveConfig(changedConfig);
    const changedHash = await hash(JSON.stringify(changedConfig));

    const resolvedArray = await engine.prepareSequenceArray(changedConfig, changedHash);

    expect(resolvedArray).not.toEqual(legacyArray);
    expect(PublicationTrackingEngine.uploadCount).toBe(1);
  });

  test('does not turn a transient artifact read failure into legacy fallback', async () => {
    const engine = new PublicationTrackingEngine(true);
    const studyId = 'sequence-publication-read-failure';
    await initializeEngine(engine, studyId);
    await engine.setSequenceArray(generateSequenceArray(config, 'legacy-seed'));
    const configHash = await hash(JSON.stringify(config));
    const resumedEngine = new PublicationTrackingEngine(true);
    await initializeEngine(resumedEngine, studyId);
    resumedEngine.failNextSequenceRead();

    await expect(resumedEngine.prepareSequenceArray(config, configHash))
      .rejects.toThrow('transient provider failure');
  });

  test('scopes cached sequence state to study and config hash', async () => {
    const engine = new PublicationTrackingEngine(true);
    const configHash = await hash(JSON.stringify(config));
    await initializeEngine(engine, 'sequence-publication-study-a');
    await engine.prepareSequenceArray(config, configHash);
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    await initializeEngine(engine, 'sequence-publication-study-b');
    await engine.prepareSequenceArray(config, configHash);

    expect(PublicationTrackingEngine.uploadCount).toBe(2);
  });

  test('uses provider time for publication leases', async () => {
    const engine = new PublicationTrackingEngine(true);
    await initializeEngine(engine, 'sequence-publication-provider-time');
    engine.useProviderTime(500);
    const configHash = await hash(JSON.stringify(config));
    engine.holdNextSequenceUpload();

    await engine.prepareSequenceArray(config, configHash);
    await engine.waitForSequenceUpload();
    const claim = await engine.claimSequenceBuild(configHash, {
      seed: 'ignored',
      algorithmVersion: 1,
      status: 'building',
      publisherId: 'clock-skewed-client',
      leaseExpiresAt: 30_499,
      attempts: 1,
      updatedAt: 499,
    }, 499);

    expect(claim.shouldPublish).toBe(false);
    expect(claim.record.leaseExpiresAt).toBe(30_500);
    engine.releaseSequenceUpload();
  });

  test('cleanup removes only explicitly nominated unreferenced artifacts', async () => {
    const engine = new PublicationTrackingEngine(true);
    await initializeEngine(engine, 'sequence-publication-cleanup');
    const firstHash = await hash(JSON.stringify(config));
    await engine.prepareSequenceArray(config, firstHash);
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    await engine.saveConfig(changedConfig);
    const activeHash = await hash(JSON.stringify(changedConfig));
    await engine.prepareSequenceArray(changedConfig, activeHash);
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    await engine.cleanupObsoleteSequenceArtifacts([firstHash, activeHash]);

    expect(await engine.getStoredSequenceArray(firstHash)).toBeNull();
    expect(await engine.getStoredSequenceArray(activeHash)).not.toBeNull();
  });

  test('config changes retain the previous hash-keyed artifact', async () => {
    const engine = new PublicationTrackingEngine(true);
    const studyId = 'sequence-publication-config-change';
    await initializeEngine(engine, studyId);
    const firstHash = await hash(JSON.stringify(config));
    const firstArray = await engine.prepareSequenceArray(config, firstHash);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    await engine.saveConfig(changedConfig);
    const secondHash = await hash(JSON.stringify(changedConfig));
    await engine.prepareSequenceArray(changedConfig, secondHash);

    const resumedEngine = new PublicationTrackingEngine(true);
    await resumedEngine.connect();
    await resumedEngine.initializeStudyDb(studyId);
    const storedFirstArray = await (
      resumedEngine as unknown as {
        _getFromStorage(
          prefix: string,
          type: 'sequenceArray',
        ): Promise<Sequence[] | null>;
      }
    )._getFromStorage(`sequenceArrays/${firstHash}`, 'sequenceArray');
    expect(storedFirstArray).toEqual(firstArray);
  });
});
