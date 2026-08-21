import { v4 as uuid } from 'uuid';
import EventEmitter from './EventEmitter';

const queryParameters = new URLSearchParams(window.location.search);

export const revisitPageId = queryParameters.get('revisitPageId') || uuid();

export const syncChannel = new BroadcastChannel(`sync-${revisitPageId}`);

export const syncEmitter = new EventEmitter();

syncChannel.onmessage = (event) => {
  const { key, value } = event.data;
  syncEmitter.emit(key, value);
};
