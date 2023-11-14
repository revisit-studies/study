import { StorageEngineConstants, StorageEngine } from './StorageEngine';

export class FirebaseStorageEngine extends StorageEngine {
  constructor(constants: StorageEngineConstants) {
    super('firebase', constants);
  }

  // TODO: Implement
  connect(): Promise<void> {
    return Promise.resolve();
  }

  isConnected(): boolean {
    return false;
  }
}