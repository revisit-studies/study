import { StorageEngine } from '../storage/engines/types';

export function getNewParticipant(storageEngine: StorageEngine | undefined, studyHref: string) {
  storageEngine?.clearCurrentParticipantId()
    .then(() => {
      window.location.href = studyHref;
    })
    .catch((err) => {
      console.error(err);
    });
}
