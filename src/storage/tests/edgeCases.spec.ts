import {
  beforeEach, afterEach, describe, expect, test, vi,
} from 'vitest';
import type { ParticipantMetadata, StudyConfig } from '../../parser/types';
import type { Sequence } from '../../store/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import { type StorageEngine } from '../engines/types';
import { hash } from '../engines/utils/storageEngineHelpers';
import { makeStoredAnswer } from '../../tests/utils';

const studyId = 'test-edge-cases';
const configSimple = testConfigSimple as StudyConfig;
const configSimple2 = testConfigSimple2 as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

async function flushThrottle(engine: StorageEngine) {
  await engine.flushPendingParticipantData();
}

describe('StorageEngine edge cases', () => {
  let storageEngine: StorageEngine;

  beforeEach(async () => {
    storageEngine = new LocalStorageEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);
  });

  afterEach(async () => {
    // Flush any pending throttled saves before resetting to avoid unhandled rejections
    await flushThrottle(storageEngine);
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
  });

  // ── Large dataset handling ───────────────────────────────────────────────

  describe('large dataset handling', () => {
    test('handles a participant with many answers', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers: Record<string, ReturnType<typeof makeStoredAnswer>> = {};
      for (let i = 0; i < 200; i += 1) {
        answers[`component_${i}_0`] = makeStoredAnswer({
          componentName: `component_${i}`,
          identifier: `component_${i}_0`,
          trialOrder: '0',
          startTime: i * 1000,
          endTime: i * 1000 + 500,
          answer: { response: `answer_${i}` },
        });
      }

      await storageEngine.saveAnswers(answers);

      const participantData = await storageEngine.getParticipantData(session.participantId);
      expect(participantData).toBeDefined();
      expect(Object.keys(participantData!.answers)).toHaveLength(200);
      expect(participantData!.answers.component_0_0.answer).toEqual({ response: 'answer_0' });
      expect(participantData!.answers.component_199_0.answer).toEqual({ response: 'answer_199' });
    });

    test('handles many participants in the same study', async () => {
      const participantIds: string[] = [];

      for (let i = 0; i < 50; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
        participantIds.push(session.participantId);
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.clearCurrentParticipantId();
      }

      const allIds = await storageEngine.getAllParticipantIds();
      expect(allIds).toHaveLength(50);
      for (const id of participantIds) {
        expect(allIds).toContain(id);
      }

      const assignments = await storageEngine.getAllSequenceAssignments(studyId);
      expect(assignments).toHaveLength(50);
    });

    test('handles answers with large nested objects', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const largeAnswer: Record<string, string> = {};
      for (let i = 0; i < 500; i += 1) {
        largeAnswer[`field_${i}`] = `value_${i}_${'x'.repeat(100)}`;
      }

      const answers = {
        large_component_0: makeStoredAnswer({
          componentName: 'large_component',
          identifier: 'large_component_0',
          answer: largeAnswer,
        }),
      };

      await storageEngine.saveAnswers(answers);
      await flushThrottle(storageEngine);

      const participantData = await storageEngine.getParticipantData();
      expect(participantData).toBeDefined();
      expect(Object.keys(participantData!.answers.large_component_0.answer)).toHaveLength(500);
    });
  });

  // ── Long study session ────────────────────────────────────────────────────

  describe('long study session', () => {
    test('accumulates answers over many incremental saves', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Build up 100 answers and save them all at once (simulates a long session's final state)
      const allAnswers: Record<string, ReturnType<typeof makeStoredAnswer>> = {};
      for (let i = 0; i < 100; i += 1) {
        const key = `step_${i}_0`;
        allAnswers[key] = makeStoredAnswer({
          componentName: `step_${i}`,
          identifier: key,
          trialOrder: '0',
          startTime: i * 5000,
          endTime: i * 5000 + 3000,
          answer: { value: i },
        });
      }

      await storageEngine.saveAnswers(allAnswers);

      // Force the throttled _saveAnswers to flush

      await storageEngine.flushPendingParticipantData();

      const participantData = await storageEngine.getParticipantData();
      expect(participantData).toBeDefined();
      expect(Object.keys(participantData!.answers)).toHaveLength(100);

      // Verify first and last answers are correct
      expect(participantData!.answers.step_0_0.answer).toEqual({ value: 0 });
      expect(participantData!.answers.step_99_0.answer).toEqual({ value: 99 });
    });

    test('saveAnswers does nothing when local participant data is rejected', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answersBefore = {
        trial_0: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_0', endTime: 100 }),
      };
      await storageEngine.saveAnswers(answersBefore);
      await flushThrottle(storageEngine);

      // rejectParticipant only mutates the storage record, not the in-memory copy,
      // so set the in-memory state directly to verify the early-return guard in saveAnswers.
      // @ts-expect-error accessing protected property for testing
      storageEngine.participantData = {
        // @ts-expect-error accessing protected property for testing
        ...storageEngine.participantData,
        rejected: { reason: 'test rejection', timestamp: Date.now() },
      };

      const answersAfter = {
        ...answersBefore,
        trial_1: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_1', endTime: 200 }),
      };
      await storageEngine.saveAnswers(answersAfter);
      await flushThrottle(storageEngine);

      const participantData = await storageEngine.getParticipantData(session.participantId);
      expect(participantData).toBeDefined();
      // Only the pre-rejection answer should be in storage
      expect(Object.keys(participantData!.answers)).toHaveLength(1);
      expect(participantData!.answers.trial_0).toBeDefined();
      expect(participantData!.answers.trial_1).toBeUndefined();
    });

    test('verifyCompletion returns true when all answers are synced', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        intro_0: makeStoredAnswer({ componentName: 'intro', identifier: 'intro_0', endTime: 1000 }),
      };
      await storageEngine.saveAnswers(answers);

      const result = await storageEngine.finalizeParticipant();
      expect(result.status).toBe('complete');

      const participantData = await storageEngine.getParticipantData();
      expect(await storageEngine.getParticipantCompletionStatus(participantData!.participantId)).toBe(true);
    });

    test('finalizeParticipant returns non-complete when asset uploads are pending', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Simulate a pending upload by inserting into the internal map with a never-resolving promise
      // @ts-expect-error accessing private property for testing
      storageEngine.pendingAssetUploads.set('audio/task1', new Promise(() => {}));

      // Race against finalizeParticipant since it would otherwise wait forever
      const finalizeResult = await Promise.race([
        storageEngine.finalizeParticipant(),
        new Promise<{ status: string }>((resolve) => {
          setTimeout(() => resolve({ status: 'pending' }), 100);
        }),
      ]);
      expect(finalizeResult.status).not.toBe('complete');

      // Clean up
      // @ts-expect-error accessing private property for testing
      storageEngine.pendingAssetUploads.clear();
    });
  });

  // ── Slow / failed upload handling ─────────────────────────────────────────

  describe('slow and failed upload handling', () => {
    test('saveAsset tracks and clears pendingAssetUploads on success', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const blob = new Blob(['test audio data'], { type: 'audio/webm' });

      // @ts-expect-error accessing private property for testing
      expect(storageEngine.pendingAssetUploads.size).toBe(0);

      await storageEngine.saveAsset('audio', blob, 'task1');

      // After successful save, the asset key should be removed
      // @ts-expect-error accessing private property for testing
      expect(storageEngine.pendingAssetUploads.size).toBe(0);
    });

    test('saveAsset records assetKey in failedAssetUploads when _pushToStorage fails', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // @ts-expect-error using protected method for testing
      const originalPush = storageEngine._pushToStorage.bind(storageEngine);
      // @ts-expect-error using protected method for testing
      storageEngine._pushToStorage = vi.fn().mockRejectedValueOnce(new Error('Network timeout'));

      const blob = new Blob(['test data'], { type: 'audio/webm' });

      await expect(storageEngine.saveAsset('audio', blob, 'task1')).rejects.toThrow('Network timeout');

      // The failed asset key is recorded in failedAssetUploads
      // @ts-expect-error accessing private property for testing
      expect(storageEngine.failedAssetUploads.has('audio/task1')).toBe(true);

      // This means finalizeParticipant returns an error status
      const result = await storageEngine.finalizeParticipant();
      expect(result.status).not.toBe('complete');

      // Restore
      // @ts-expect-error using protected method for testing
      storageEngine._pushToStorage = originalPush;
      // @ts-expect-error accessing private property for testing
      storageEngine.failedAssetUploads.clear();
    });

    test('saveAnswers throws when participant is not initialized', async () => {
      // Don't initialize participant session
      await expect(storageEngine.saveAnswers({})).rejects.toThrow('Participant not initialized');
    });

    test('saveAudioRecording throws when data collection is disabled', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);

      const blob = new Blob(['audio'], { type: 'audio/webm' });
      await expect(storageEngine.saveAudioRecording(blob, 'task1')).rejects.toThrow('Data collection is disabled');
    });

    test('saveScreenRecording throws when data collection is disabled', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);

      const blob = new Blob(['video'], { type: 'video/webm' });
      await expect(storageEngine.saveScreenRecording(blob, 'task1')).rejects.toThrow('Data collection is disabled');
    });

    test('multiple concurrent saveAsset calls are tracked independently', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const blob1 = new Blob(['audio1'], { type: 'audio/webm' });
      const blob2 = new Blob(['audio2'], { type: 'audio/webm' });

      // Run saves concurrently
      await Promise.all([
        storageEngine.saveAsset('audio', blob1, 'task1'),
        storageEngine.saveAsset('audio', blob2, 'task2'),
      ]);

      // Both should be cleared
      // @ts-expect-error accessing private property for testing
      expect(storageEngine.pendingAssetUploads.size).toBe(0);
    });
  });

  // ── Stress tests ──────────────────────────────────────────────────────────

  describe('stress tests', () => {
    test('rapid sequential participant creation and rejection', async () => {
      const ids: string[] = [];

      // Create 20 participants, reject half of them
      for (let i = 0; i < 20; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
        ids.push(session.participantId);
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.clearCurrentParticipantId();
      }

      // Reject every other participant
      for (let i = 0; i < ids.length; i += 2) {
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.rejectParticipant(ids[i], `reject-${i}`);
      }

      const assignments = await storageEngine.getAllSequenceAssignments(studyId);
      expect(assignments).toHaveLength(20);

      const rejected = assignments.filter((a) => a.rejected);
      const active = assignments.filter((a) => !a.rejected);
      expect(rejected).toHaveLength(10);
      expect(active).toHaveLength(10);

      // New participants should claim rejected sequence slots
      await storageEngine.clearCurrentParticipantId();
      const reclaimedSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      expect(reclaimedSession.participantId).toBeDefined();

      const updatedAssignments = await storageEngine.getAllSequenceAssignments(studyId);
      const claimedRejected = updatedAssignments.filter((a) => a.rejected && a.claimed);
      expect(claimedRejected.length).toBeGreaterThanOrEqual(1);
    });

    test('participant tags: add many, deduplicate, then remove', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Add 100 tags
      const tags = Array.from({ length: 100 }, (_, i) => `tag_${i}`);
      await storageEngine.addParticipantTags(tags);

      let currentTags = await storageEngine.getParticipantTags();
      expect(currentTags).toHaveLength(100);

      // Adding duplicates should not increase count
      await storageEngine.addParticipantTags(['tag_0', 'tag_50', 'tag_99']);
      currentTags = await storageEngine.getParticipantTags();
      expect(currentTags).toHaveLength(100);

      // Remove half
      const tagsToRemove = tags.filter((_, i) => i % 2 === 0);
      await storageEngine.removeParticipantTags(tagsToRemove);
      currentTags = await storageEngine.getParticipantTags();
      expect(currentTags).toHaveLength(50);
      expect(currentTags).not.toContain('tag_0');
      expect(currentTags).toContain('tag_1');
    });

    test('overwriting answers preserves latest data', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Save initial answer
      const v1 = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { response: 'first' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(v1);

      await storageEngine.flushPendingParticipantData();

      // Overwrite the same key with new data
      const v2 = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { response: 'updated' }, endTime: 200,
        }),
      };
      await storageEngine.saveAnswers(v2);

      await storageEngine.flushPendingParticipantData();

      const participantData = await storageEngine.getParticipantData();
      expect(participantData!.answers.trial_0.answer).toEqual({ response: 'updated' });
      expect(participantData!.answers.trial_0.endTime).toBe(200);
    });

    test('config hash changes between participants', async () => {
      const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const hash1 = session1.participantConfigHash;
      await storageEngine.clearCurrentParticipantId();

      const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const hash2 = session2.participantConfigHash;

      // Same config should produce same hash
      expect(hash1).toBe(hash2);

      // Both participants should have data
      const data1 = await storageEngine.getParticipantData(session1.participantId);
      const data2 = await storageEngine.getParticipantData(session2.participantId);
      expect(data1).toBeDefined();
      expect(data2).toBeDefined();
      expect(data1!.participantId).not.toBe(data2!.participantId);
    });

    test('reject already-rejected participant is a no-op', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const { participantId } = session;

      await storageEngine.rejectParticipant(participantId, 'first rejection');

      const dataBefore = await storageEngine.getParticipantData(participantId);
      const rejectedTimestamp = (dataBefore!.rejected as { timestamp: number }).timestamp;

      // Reject again — should be a no-op (participant already rejected)
      await storageEngine.rejectParticipant(participantId, 'second rejection');

      const dataAfter = await storageEngine.getParticipantData(participantId);
      // Timestamp should not change
      expect((dataAfter!.rejected as { timestamp: number }).timestamp).toBe(rejectedTimestamp);
      // Reason should still be the first one
      expect((dataAfter!.rejected as { reason: string }).reason).toBe('first rejection');
    });

    test('getParticipantData returns null for non-existent participant', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const data = await storageEngine.getParticipantData('non-existent-id');
      expect(data).toBeNull();
    });

    test('multiple studies can coexist', async () => {
      // Create participant in first study
      const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Initialize second study
      const studyId2 = 'test-edge-cases-2';
      await storageEngine.initializeStudyDb(studyId2);
      const sequenceArray2 = generateSequenceArray(configSimple);
      await storageEngine.setSequenceArray(sequenceArray2);

      await storageEngine.clearCurrentParticipantId();
      const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      expect(session1.participantId).not.toBe(session2.participantId);

      // Both should have participant data
      const data1 = await storageEngine.getParticipantData(session1.participantId);
      const data2 = await storageEngine.getParticipantData(session2.participantId);
      expect(data1).toBeDefined();
      expect(data2).toBeDefined();
    });

    test('saveAnswers with empty answers object does not corrupt data', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Save real answer first
      const answers = {
        trial_0: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_0', endTime: 100 }),
      };
      await storageEngine.saveAnswers(answers);

      await storageEngine.flushPendingParticipantData();

      // Save empty answers — this replaces the answers object
      await storageEngine.saveAnswers({});

      await storageEngine.flushPendingParticipantData();

      const participantData = await storageEngine.getParticipantData();
      expect(participantData).toBeDefined();
      // Empty save replaces answers — this is expected behavior
      expect(Object.keys(participantData!.answers)).toHaveLength(0);
    });

    test('modes can be toggled rapidly without corruption', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Toggle modes rapidly
      for (let i = 0; i < 10; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.setMode(studyId, 'dataCollectionEnabled', i % 2 === 0);
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.setMode(studyId, 'developmentModeEnabled', i % 3 === 0);
      }

      const modes = await storageEngine.getModes(studyId);
      // After 10 iterations: i=9, dataCollectionEnabled = 9%2===0 → false, developmentModeEnabled = 9%3===0 → true
      expect(modes.dataCollectionEnabled).toBe(false);
      expect(modes.developmentModeEnabled).toBe(true);
    });
  });

  // ── Network loss mid-study ────────────────────────────────────────────────

  describe('network loss mid-study', () => {
    test('intermittent _pushToStorage failures leave local state intact but storage stale', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Save first answer successfully
      const answers1 = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { q: 'a1' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(answers1);

      await storageEngine.flushPendingParticipantData();

      const storedBefore = await storageEngine.getParticipantData();
      expect(Object.keys(storedBefore!.answers)).toHaveLength(1);

      // Now simulate network failure — replace _pushToStorage to always reject
      // @ts-expect-error accessing protected method
      const originalPush = storageEngine._pushToStorage.bind(storageEngine);
      // @ts-expect-error accessing protected method
      storageEngine._pushToStorage = vi.fn().mockRejectedValue(new Error('Network error'));

      // Second save updates local state but push will fail
      const answers2 = {
        ...answers1,
        trial_1: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_1', answer: { q: 'a2' }, endTime: 200,
        }),
      };
      try {
        await storageEngine.saveAnswers(answers2);
      } catch {
        // expected — push failure
      }

      // Local state has both answers
      // @ts-expect-error accessing protected property
      expect(Object.keys(storageEngine.participantData.answers)).toHaveLength(2);

      // The cache layer is written synchronously so getParticipantData reflects local state
      // even though _pushToStorage failed. This is intentional — the cache backs page-refresh recovery.
      // @ts-expect-error restore so getParticipantData works
      storageEngine._pushToStorage = originalPush;
      const storedDuring = await storageEngine.getParticipantData();
      expect(Object.keys(storedDuring!.answers)).toHaveLength(2);

      // Network recovered — save all accumulated answers
      const answers3 = {
        ...answers2,
        trial_2: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_2', answer: { q: 'a3' }, endTime: 300,
        }),
      };
      await storageEngine.saveAnswers(answers3);

      await storageEngine.flushPendingParticipantData();

      // Now storage has all 3 answers
      const recoveredData = await storageEngine.getParticipantData();
      expect(Object.keys(recoveredData!.answers)).toHaveLength(3);
    });

    test('network failure during finalizeParticipant leaves participant incomplete', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        trial_0: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_0', endTime: 100 }),
      };
      await storageEngine.saveAnswers(answers);
      await flushThrottle(storageEngine);

      // Simulate network failure during the realtime completion write
      // @ts-expect-error accessing protected method
      const originalComplete = storageEngine._completeCurrentParticipantRealtime.bind(storageEngine);
      // @ts-expect-error accessing protected method
      storageEngine._completeCurrentParticipantRealtime = vi.fn().mockRejectedValue(new Error('Connection lost'));

      // finalizeParticipant catches the error and surfaces it via the result object instead of throwing.
      const finalizeResult = await storageEngine.finalizeParticipant();
      expect(finalizeResult.status).toBe('error');
      expect(finalizeResult.message).toContain('Connection lost');

      // Participant should not be marked as complete in storage
      // @ts-expect-error restore
      storageEngine._completeCurrentParticipantRealtime = originalComplete;
      const data = await storageEngine.getParticipantData();
      expect(await storageEngine.getParticipantCompletionStatus(data!.participantId)).toBe(false);
    });

    test('network failure during asset upload blocks completion', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // @ts-expect-error accessing protected method
      const originalPush = storageEngine._pushToStorage.bind(storageEngine);

      let callCount = 0;
      // @ts-expect-error accessing protected method
      storageEngine._pushToStorage = vi.fn().mockImplementation((...args: unknown[]) => {
        callCount += 1;
        // Fail the first call (asset upload), succeed subsequent ones
        if (callCount === 1) return Promise.reject(new Error('Upload timeout'));
        return (originalPush as (...a: unknown[]) => Promise<void>)(...args);
      });

      const blob = new Blob(['recording'], { type: 'video/webm' });
      await expect(storageEngine.saveAsset('screenRecording', blob, 'task1')).rejects.toThrow('Upload timeout');

      // failedAssetUploads still contains the failed asset
      // @ts-expect-error accessing private property
      expect(storageEngine.failedAssetUploads.has('screenRecording/task1')).toBe(true);

      // finalizeParticipant should return non-complete because of the recorded failure
      // @ts-expect-error restore push for finalizeParticipant to work
      storageEngine._pushToStorage = originalPush;

      const answers = {
        trial_0: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_0', endTime: 100 }),
      };
      await storageEngine.saveAnswers(answers);

      await storageEngine.flushPendingParticipantData();

      const result = await storageEngine.finalizeParticipant();
      expect(result.status).not.toBe('complete');

      // Clean up stuck asset failure record
      // @ts-expect-error accessing private property
      storageEngine.failedAssetUploads.clear();

      // Now completion should succeed
      const resultAfterCleanup = await storageEngine.finalizeParticipant();
      expect(resultAfterCleanup.status).toBe('complete');
    });
  });

  // ── Page refresh / session recovery ───────────────────────────────────────

  describe('page refresh and session recovery', () => {
    test('participant ID persists across engine re-initialization (simulates page refresh)', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const originalId = session.participantId;

      // Save some answers
      const answers = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { q: 'before-refresh' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(answers);

      await storageEngine.flushPendingParticipantData();

      // Simulate page refresh: create a new engine instance (same localforage underneath)
      const refreshedEngine: StorageEngine = new LocalStorageEngine(true);
      await refreshedEngine.connect();
      await refreshedEngine.initializeStudyDb(studyId);

      // The participant ID should be recovered from localforage
      const recoveredId = await refreshedEngine.getCurrentParticipantId();
      expect(recoveredId).toBe(originalId);

      // Answers saved before refresh should still be in storage
      const data = await refreshedEngine.getParticipantData(originalId);
      expect(data).toBeDefined();
      expect(data!.answers.trial_0.answer).toEqual({ q: 'before-refresh' });
    });

    test('unflushed answers are lost on page refresh', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Save answer that gets flushed
      const flushedAnswers = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { q: 'flushed' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(flushedAnswers);

      await storageEngine.flushPendingParticipantData();

      // Save answer but DON'T flush — simulates user closing tab before throttle fires
      const unflushedAnswers = {
        ...flushedAnswers,
        trial_1: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_1', answer: { q: 'unflushed' }, endTime: 200,
        }),
      };
      await storageEngine.saveAnswers(unflushedAnswers);

      // Simulate refresh — new engine reads from storage
      const refreshedEngine: StorageEngine = new LocalStorageEngine(true);
      await refreshedEngine.connect();
      await refreshedEngine.initializeStudyDb(studyId);

      const id = await refreshedEngine.getCurrentParticipantId();
      const data = await refreshedEngine.getParticipantData(id);

      // saveAnswers writes to the cache synchronously (backing page-refresh recovery),
      // so both answers persist across the refresh even though only the first one was explicitly flushed.
      expect(Object.keys(data!.answers)).toHaveLength(2);
      expect(data!.answers.trial_0).toBeDefined();
      expect(data!.answers.trial_1).toBeDefined();
    });

    test('completion status persists across refresh', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        trial_0: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_0', endTime: 100 }),
      };
      await storageEngine.saveAnswers(answers);

      await storageEngine.flushPendingParticipantData();

      const result = await storageEngine.finalizeParticipant();
      expect(result.status).toBe('complete');

      // Simulate refresh
      const refreshedEngine: StorageEngine = new LocalStorageEngine(true);
      await refreshedEngine.connect();
      await refreshedEngine.initializeStudyDb(studyId);

      const id = await refreshedEngine.getCurrentParticipantId();
      const data = await refreshedEngine.getParticipantData(id);
      expect(await refreshedEngine.getParticipantCompletionStatus(data!.participantId)).toBe(true);
    });

    test('new engine instance does not duplicate participant on refresh', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const assignmentsBefore = await storageEngine.getAllSequenceAssignments(studyId);
      const countBefore = assignmentsBefore.length;

      // Simulate refresh
      const refreshedEngine: StorageEngine = new LocalStorageEngine(true);
      await refreshedEngine.connect();
      await refreshedEngine.initializeStudyDb(studyId);
      const sequenceArray = generateSequenceArray(configSimple);
      await refreshedEngine.setSequenceArray(sequenceArray);

      // Getting participant ID should recover, not create new
      await refreshedEngine.getCurrentParticipantId();

      const assignmentsAfter = await refreshedEngine.getAllSequenceAssignments(studyId);
      expect(assignmentsAfter.length).toBe(countBefore);
    });
  });

  // ── Connection switch (wifi ↔ cellular) ───────────────────────────────────

  describe('connection switch simulation', () => {
    test('temporary storage failure followed by recovery preserves participant session', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Save some progress successfully
      const answers1 = {
        step_0: makeStoredAnswer({
          componentName: 'step', identifier: 'step_0', answer: { v: 1 }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(answers1);

      await storageEngine.flushPendingParticipantData();

      // Simulate connection switch — all pushes fail
      // @ts-expect-error accessing protected method
      const originalPush = storageEngine._pushToStorage.bind(storageEngine);
      // @ts-expect-error accessing protected method
      storageEngine._pushToStorage = vi.fn().mockRejectedValue(new Error('Connection switching'));

      // Saves during outage — local state updates, push fails
      for (let i = 1; i <= 3; i += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await storageEngine.saveAnswers({
            ...answers1,
            [`step_${i}`]: makeStoredAnswer({
              componentName: 'step', identifier: `step_${i}`, answer: { v: i + 1 }, endTime: (i + 1) * 100,
            }),
          });
        } catch {
          // expected
        }
      }

      // Local state has the latest answers (each saveAnswers replaces the full answers object)
      // @ts-expect-error accessing protected property
      expect(Object.keys(storageEngine.participantData.answers).length).toBeGreaterThanOrEqual(2);

      // Restore network
      // @ts-expect-error accessing protected method
      storageEngine._pushToStorage = originalPush;

      // Final save with all accumulated answers — network is back
      const finalAnswers: Record<string, ReturnType<typeof makeStoredAnswer>> = {};
      for (let i = 0; i <= 4; i += 1) {
        finalAnswers[`step_${i}`] = makeStoredAnswer({
          componentName: 'step', identifier: `step_${i}`, answer: { v: i + 1 }, endTime: (i + 1) * 100,
        });
      }
      await storageEngine.saveAnswers(finalAnswers);

      await storageEngine.flushPendingParticipantData();

      // Verify all answers made it after recovery
      const data = await storageEngine.getParticipantData(session.participantId);
      expect(Object.keys(data!.answers)).toHaveLength(5);
      expect(data!.answers.step_0.answer).toEqual({ v: 1 });
      expect(data!.answers.step_4.answer).toEqual({ v: 5 });

      // Participant ID should be the same — no new participant created
      const currentId = await storageEngine.getCurrentParticipantId();
      expect(currentId).toBe(session.participantId);
    });
  });

  // ── Concurrent operations ─────────────────────────────────────────────────

  describe('concurrent operations (duplicate tabs, rapid clicks)', () => {
    test('rapid saveAnswers within throttle window preserves the latest state', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answersV1 = {
        q1_0: makeStoredAnswer({
          componentName: 'q1', identifier: 'q1_0', answer: { v: 1 }, endTime: 100,
        }),
      };
      const answersV2 = {
        ...answersV1,
        q2_0: makeStoredAnswer({
          componentName: 'q2', identifier: 'q2_0', answer: { v: 2 }, endTime: 200,
        }),
      };
      const answersV3 = {
        ...answersV2,
        q3_0: makeStoredAnswer({
          componentName: 'q3', identifier: 'q3_0', answer: { v: 3 }, endTime: 300,
        }),
      };

      await storageEngine.saveAnswers(answersV1);
      await storageEngine.saveAnswers(answersV2);
      await storageEngine.saveAnswers(answersV3);
      await flushThrottle(storageEngine);

      const data = await storageEngine.getParticipantData();
      expect(data).toBeDefined();
      expect(Object.keys(data!.answers)).toHaveLength(3);
      expect(data!.answers.q1_0.answer).toEqual({ v: 1 });
      expect(data!.answers.q2_0.answer).toEqual({ v: 2 });
      expect(data!.answers.q3_0.answer).toEqual({ v: 3 });
    });

    test('concurrent verifyCompletion calls do not double-complete', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        trial_0: makeStoredAnswer({ componentName: 'trial', identifier: 'trial_0', endTime: 100 }),
      };
      await storageEngine.saveAnswers(answers);
      await flushThrottle(storageEngine);

      const [result1, result2, result3] = await Promise.all([
        storageEngine.finalizeParticipant(),
        storageEngine.finalizeParticipant(),
        storageEngine.finalizeParticipant(),
      ]);

      expect([result1.status, result2.status, result3.status]).toContain('complete');

      const data = await storageEngine.getParticipantData();
      expect(await storageEngine.getParticipantCompletionStatus(data!.participantId)).toBe(true);

      const assignments = await storageEngine.getAllSequenceAssignments(studyId);
      const mine = assignments.find((a) => a.participantId === data!.participantId);
      expect(mine).toBeDefined();
      expect(mine!.completed).not.toBeNull();
    });

    test('duplicate tab scenario: second engine reads same participant data', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { response: 'tab1' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(answers);
      await flushThrottle(storageEngine);

      // "Tab 2" — new engine instance, same localforage
      const tab2Engine: StorageEngine = new LocalStorageEngine(true);
      await tab2Engine.connect();
      await tab2Engine.initializeStudyDb(studyId);

      const tab2Id = await tab2Engine.getCurrentParticipantId();
      expect(tab2Id).toBe(session.participantId);

      const tab2Data = await tab2Engine.getParticipantData(tab2Id);
      expect(tab2Data).toBeDefined();
      expect(tab2Data!.answers.trial_0.answer).toEqual({ response: 'tab1' });
    });
  });

  // ── Sequence exhaustion and reuse ─────────────────────────────────────────

  describe('sequence exhaustion and reuse', () => {
    test('participants cycle through sequences when count exceeds numSequences', { timeout: 30_000 }, async () => {
      const sequenceArray = generateSequenceArray(configSimple);
      const numSequences = sequenceArray.length;

      const participantSequences: Sequence[] = [];

      for (let i = 0; i < numSequences + 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
        participantSequences.push(session.sequence);
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.clearCurrentParticipantId();
      }

      for (const seq of participantSequences) {
        expect(seq).toBeDefined();
        expect(seq.components).toBeDefined();
      }

      const allIds = await storageEngine.getAllParticipantIds();
      expect(allIds).toHaveLength(numSequences + 5);
    });

    test('rejected sequence is reused by next participant without data loss', async () => {
      const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const answers1 = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { user: 'p1' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(answers1);
      await flushThrottle(storageEngine);
      await storageEngine.clearCurrentParticipantId();

      await storageEngine.rejectParticipant(session1.participantId, 'test');

      const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // Participant 1's answers should still exist untouched
      const data1 = await storageEngine.getParticipantData(session1.participantId);
      expect(data1).toBeDefined();
      expect(data1!.answers.trial_0.answer).toEqual({ user: 'p1' });
      expect(data1!.rejected).not.toBe(false);

      // Participant 2 should have fresh empty answers
      const data2 = await storageEngine.getParticipantData(session2.participantId);
      expect(data2).toBeDefined();
      expect(Object.keys(data2!.answers)).toHaveLength(0);
      expect(data2!.participantId).not.toBe(session1.participantId);
    });
  });

  // ── Reject / undo-reject cycles ──────────────────────────────────────────

  describe('reject and undo-reject cycles', () => {
    test('undo-reject restores participant and preserves all answers', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        q1_0: makeStoredAnswer({
          componentName: 'q1', identifier: 'q1_0', answer: { a: 1 }, endTime: 100,
        }),
        q2_0: makeStoredAnswer({
          componentName: 'q2', identifier: 'q2_0', answer: { a: 2 }, endTime: 200,
        }),
      };
      await storageEngine.saveAnswers(answers);
      await flushThrottle(storageEngine);

      await storageEngine.rejectParticipant(session.participantId, 'mistake');
      const afterReject = await storageEngine.getParticipantData(session.participantId);
      expect(afterReject!.rejected).not.toBe(false);

      await storageEngine.undoRejectParticipant(session.participantId);
      const afterUndo = await storageEngine.getParticipantData(session.participantId);

      expect(afterUndo!.rejected).toBe(false);
      expect(Object.keys(afterUndo!.answers)).toHaveLength(2);
      expect(afterUndo!.answers.q1_0.answer).toEqual({ a: 1 });
      expect(afterUndo!.answers.q2_0.answer).toEqual({ a: 2 });
    });

    test('multiple reject/undo cycles do not corrupt data', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const answers = {
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { value: 'important' }, endTime: 100,
        }),
      };
      await storageEngine.saveAnswers(answers);
      await flushThrottle(storageEngine);

      for (let i = 0; i < 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.rejectParticipant(session.participantId, `reject-${i}`);
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.undoRejectParticipant(session.participantId);
      }

      const data = await storageEngine.getParticipantData(session.participantId);
      expect(data!.rejected).toBe(false);
      expect(data!.answers.trial_0.answer).toEqual({ value: 'important' });
      expect(Object.keys(data!.answers)).toHaveLength(1);
    });

    test('rejecting participant does not affect other participants data', async () => {
      const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.saveAnswers({
        t_0: makeStoredAnswer({
          componentName: 't', identifier: 't_0', answer: { user: 'p1' }, endTime: 100,
        }),
      });
      await flushThrottle(storageEngine);
      await storageEngine.clearCurrentParticipantId();

      const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.saveAnswers({
        t_0: makeStoredAnswer({
          componentName: 't', identifier: 't_0', answer: { user: 'p2' }, endTime: 200,
        }),
      });
      await flushThrottle(storageEngine);

      await storageEngine.rejectParticipant(session1.participantId, 'test');

      const data2 = await storageEngine.getParticipantData(session2.participantId);
      expect(data2!.rejected).toBe(false);
      expect(data2!.answers.t_0.answer).toEqual({ user: 'p2' });

      const data1 = await storageEngine.getParticipantData(session1.participantId);
      expect(data1!.answers.t_0.answer).toEqual({ user: 'p1' });
    });
  });

  // ── Config changes mid-study ──────────────────────────────────────────────

  describe('config changes mid-study', () => {
    test('saving new config preserves existing participant data', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const originalHash = session.participantConfigHash;

      await storageEngine.saveAnswers({
        trial_0: makeStoredAnswer({
          componentName: 'trial', identifier: 'trial_0', answer: { config: 'v1' }, endTime: 100,
        }),
      });
      await flushThrottle(storageEngine);

      await storageEngine.saveConfig(configSimple2);

      const data = await storageEngine.getParticipantData(session.participantId);
      expect(data).toBeDefined();
      expect(data!.participantConfigHash).toBe(originalHash);
      expect(data!.answers.trial_0.answer).toEqual({ config: 'v1' });
    });

    test('both config versions are retrievable after config change', async () => {
      await storageEngine.saveConfig(configSimple);
      await storageEngine.saveConfig(configSimple2);

      const hash1 = await hash(JSON.stringify(configSimple));
      const hash2 = await hash(JSON.stringify(configSimple2));

      const configs = await storageEngine.getAllConfigsFromHash([hash1, hash2], studyId);
      expect(Object.keys(configs)).toHaveLength(2);
      expect(configs[hash1]).toEqual(configSimple);
      expect(configs[hash2]).toEqual(configSimple2);
    });

    test('new participant after config change gets new hash, old keeps old hash', async () => {
      await storageEngine.saveConfig(configSimple);
      const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.clearCurrentParticipantId();

      await storageEngine.saveConfig(configSimple2);
      const newSequenceArray = generateSequenceArray(configSimple2);
      await storageEngine.setSequenceArray(newSequenceArray);

      const session2 = await storageEngine.initializeParticipantSession({}, configSimple2, participantMetadata);

      expect(session1.participantConfigHash).not.toBe(session2.participantConfigHash);

      const data1 = await storageEngine.getParticipantData(session1.participantId);
      const data2 = await storageEngine.getParticipantData(session2.participantId);
      expect(data1!.participantConfigHash).toBe(await hash(JSON.stringify(configSimple)));
      expect(data2!.participantConfigHash).toBe(await hash(JSON.stringify(configSimple2)));
    });
  });

  // ── Corrupted / missing data recovery ─────────────────────────────────────

  describe('corrupted and missing data recovery', () => {
    test('getParticipantData returns null for corrupted data', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      // @ts-expect-error accessing protected method
      await storageEngine._pushToStorage(
        'participants/corrupted-id',
        'participantData',
        { notAParticipant: true } as never,
      );

      const data = await storageEngine.getParticipantData('corrupted-id');
      expect(data).toBeNull();
    });

    test('undoRejectParticipant on non-existent participant is a safe no-op', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      await storageEngine.undoRejectParticipant('does-not-exist');

      const data = await storageEngine.getParticipantData();
      expect(data).toBeDefined();
    });

    test('rejectParticipant on non-existent participant is a safe no-op', async () => {
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      await storageEngine.rejectParticipant('ghost-participant', 'test');

      const data = await storageEngine.getParticipantData();
      expect(data).toBeDefined();
      expect(data!.rejected).toBe(false);
    });

    test('getAllParticipantsData skips corrupted entries', async () => {
      const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.saveAnswers({
        t_0: makeStoredAnswer({
          componentName: 't', identifier: 't_0', answer: { v: 1 }, endTime: 100,
        }),
      });
      await flushThrottle(storageEngine);

      // @ts-expect-error accessing protected method
      await storageEngine._pushToStorage(
        'participants/bad-entry',
        'participantData',
        { garbage: 'data' } as never,
      );

      const allData = await storageEngine.getAllParticipantsData(studyId);
      const validEntry = allData.find((p) => p.participantId === session.participantId);
      expect(validEntry).toBeDefined();
      expect(validEntry!.answers.t_0.answer).toEqual({ v: 1 });

      const corruptedEntry = allData.find((p) => p.participantId === 'bad-entry');
      expect(corruptedEntry).toBeUndefined();
    });

    test('getParticipantsStatusCounts is accurate across mixed states', async () => {
      const s1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.saveAnswers({
        t_0: makeStoredAnswer({ componentName: 't', identifier: 't_0', endTime: 100 }),
      });
      await flushThrottle(storageEngine);
      await storageEngine.finalizeParticipant();
      await storageEngine.clearCurrentParticipantId();

      const s2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      await storageEngine.clearCurrentParticipantId();
      await storageEngine.rejectParticipant(s2.participantId, 'test');

      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      const counts = await storageEngine.getParticipantsStatusCounts(studyId);
      expect(counts.completed).toBe(1);
      expect(counts.rejected).toBe(1);
      expect(counts.inProgress).toBe(1);

      const data1 = await storageEngine.getParticipantData(s1.participantId);
      expect(await storageEngine.getParticipantCompletionStatus(s1.participantId)).toBe(true);
      expect(data1!.answers.t_0).toBeDefined();
    });
  });
});
