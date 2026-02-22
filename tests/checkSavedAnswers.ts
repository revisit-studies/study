import { expect, Page } from '@playwright/test';
import { ParticipantData } from '../src/storage/types';

async function getCurrentParticipantData(page: Page, studyIdExternal: string) {
  return page.evaluate(async (studyId) => {
    let db: IDBDatabase;
    const request = indexedDB.open('revisit');

    return new Promise((resolve) => {
      request.onsuccess = async (event: Event) => {
        db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['keyvaluepairs'], 'readonly');
        const store = transaction.objectStore('keyvaluepairs');
        const currentParticipant = store.get(`${studyId}/currentParticipantId`);

        currentParticipant.onsuccess = () => {
          const currentParticipantId = studyId === 'dev-example-VLAT-full-randomized' ? 'test' : currentParticipant.result;
          const participantData = store.get(`${studyId}/participants/${currentParticipantId}_participantData`);
          participantData.onsuccess = () => resolve(participantData.result);
        };
      };
    });
  }, `dev-${studyIdExternal}`);
}

export async function checkSavedAnswers(page: Page, studyId: string) {
  await expect.poll(async () => {
    const participantData = await getCurrentParticipantData(page, studyId) as ParticipantData;
    const { answers } = participantData;
    const answeredQuestions = Object.entries(answers).filter(([key, value]) => !key.startsWith('_') && value.endTime > -1);
    return answeredQuestions.length - Object.keys(answers).length;
  }, { timeout: 10000 }).toBe(0);

  const participantData = await getCurrentParticipantData(page, studyId) as ParticipantData;
  const { answers } = participantData;

  if (studyId === 'example-VLAT-full-randomized') {
    // Check specific answers for VLAT study
    const componentAnswer = Object.entries(answers).find(([key, _]) => key.startsWith('$vlat.components.stackbar100-comparisons-relative'))?.[1].answer;
    await expect(componentAnswer).toEqual({ 'res-stackbar100-comparisons-relative': 'True' });
    await expect(answers.survey_55.answer).toEqual({ q1: 'no', q2: 'no', q3: 'no' });
  }
}
