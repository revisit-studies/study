import { StudyConfig } from '../parser/types';
import { StorageEngine } from '../storage/engines/StorageEngine';
import { ParticipantMetadata } from '../store/types';

export function getNewParticipant(storageEngine: StorageEngine | undefined, studyConfig: StudyConfig, metadata: ParticipantMetadata, studyHref: string) {
  storageEngine?.nextParticipant()
    .then(() => {
      window.location.href = studyHref;
    })
    .catch((err) => {
      console.error(err);
    });
}
