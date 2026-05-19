/**
 * Shared tests that verify consistent behavior across storage engines
 * for the rejectParticipant flow.
 *
 * These tests catch behavioral drift between engines and in-memory
 * state corruption risks.
 *
 * Run against each engine to verify consistency:
 *   yarn unittest src/storage/tests/rejectParticipantConsistency.spec.ts
 */
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { type StorageEngine } from '../engines/types';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';

const studyId = 'test-reject-consistency';
const configSimple = testConfigSimple as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

describe('rejectParticipant — shared behavior tests', () => {
  let storageEngine: StorageEngine;

  beforeEach(async () => {
    storageEngine = new LocalStorageEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);
  });

  afterEach(async () => {
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
  });

  test('rejectParticipant marks the participant as rejected and clears claimed flag', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    await storageEngine.rejectParticipant(session.participantId, 'Test rejection');

    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    const assignment = assignments.find((a) => a.participantId === session.participantId);

    expect(assignment).toBeDefined();
    expect(assignment!.rejected).toBe(true);
    expect(assignment!.claimed).toBe(false);
  });

  test('_undoRejectParticipantRealtime resets rejected flag', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Reject the participant
    await storageEngine.rejectParticipant(session.participantId, 'Test rejection');

    // Undo the rejection
    // @ts-expect-error protected method
    storageEngine.currentParticipantId = session.participantId;
    // @ts-expect-error protected method
    await storageEngine._undoRejectParticipantRealtime(session.participantId);

    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    const assignment = assignments.find((a) => a.participantId === session.participantId);

    expect(assignment).toBeDefined();
    expect(assignment!.rejected).toBe(false);
  });

  // ── Bug-catching tests ──────────────────────────────────────────────────

  test('rejectParticipant does NOT corrupt in-memory participantData when storage write fails', async () => {
    /**
     * This test catches a regression where rejectParticipant mutates
     * this.participantData directly before _pushToStorage succeeds.
     * If the storage write fails, the in-memory state is already corrupted.
     *
     * The correct behavior: in-memory state should remain unchanged on failure.
     */
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Capture the original in-memory state
    // @ts-expect-error accessing protected property
    const originalRejected = storageEngine.participantData.rejected;

    // Mock _pushToStorage to throw, simulating a storage failure
    // @ts-expect-error accessing protected method
    const originalPushToStorage = storageEngine._pushToStorage;
    // @ts-expect-error accessing protected method
    storageEngine._pushToStorage = vi.fn().mockRejectedValue(new Error('Storage write failed'));

    // Reject should catch the error and not throw
    await storageEngine.rejectParticipant(session.participantId, 'Test rejection');

    // Restore the mock
    // @ts-expect-error accessing protected method
    storageEngine._pushToStorage = originalPushToStorage;

    // BUG: The in-memory participantData IS corrupted (rejected is set)
    // This test should FAIL until the bug is fixed
    // @ts-expect-error accessing protected property
    expect(storageEngine.participantData?.rejected).toEqual(originalRejected);
    // @ts-expect-error accessing protected property
    expect(storageEngine.participantData?.rejected).toBe(false);
  });

  test('claimed assignment has rejected=true after another participant is rejected (cross-engine consistency)', async () => {
    /**
     * This test catches a behavioral inconsistency between storage engines.
     *
     * When participant B rejects and participant A had the claimed assignment
     * with the same timestamp, the expected behavior (shared by LocalStorage
     * and Firebase) is that participant A's assignment should have:
     *   - claimed: false (available for reuse)
     *   - rejected: true (marked as rejected so it doesn't get reused again)
     *
     * If an engine only sets claimed=false but NOT rejected=true, the claimed
     * assignment could be incorrectly reused. This test asserts the correct
     * behavior: rejected should be true on the claimed assignment.
     *
     * Run against each engine to verify consistency.
     */
    // Initialize first participant
    const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Reject the first participant (this triggers _claimSequenceAssignment
    // when the next participant is initialized)
    await storageEngine.rejectParticipant(session1.participantId, 'Test rejection');
    await storageEngine.clearCurrentParticipantId();

    // Initialize second participant (will reuse the same sequence/timestamp)
    // This triggers _claimSequenceAssignment on session1's assignment
    const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Reject the second participant
    await storageEngine.rejectParticipant(session2.participantId, 'Test rejection');

    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    const assignment1 = assignments.find((a) => a.participantId === session1.participantId);
    const assignment2 = assignments.find((a) => a.participantId === session2.participantId);

    // Both assignments should exist
    expect(assignment1).toBeDefined();
    expect(assignment2).toBeDefined();

    // The second participant should be rejected
    expect(assignment2!.rejected).toBe(true);
    expect(assignment2!.claimed).toBe(false);

    // The first participant's claimed assignment should be marked as rejected
    // BUG: Some engines (e.g., Supabase) only set claimed=false but NOT rejected=true
    // This test should FAIL until all engines are aligned
    expect(assignment1!.rejected).toBe(true);
    expect(assignment1!.claimed).toBe(false);
  });
});
