import { appendMode } from './utils';

export const MODE = import.meta.env.PROD ? 'prod' : 'dev';
export const PID_KEY = '__pid';
export const CONN_CHECK = appendMode('__conn_check', MODE);
export const PARTICIPANTS = appendMode('participants', MODE);
export const STUDIES = appendMode('studies', MODE);
export const SESSIONS = appendMode('sessions', MODE);
export const TRRACKS = appendMode('trracks', MODE);
export const NODES = 'nodes';
export const TRRACK = 'trrack';
export const RECAPTCHAV3TOKEN = '6LdjOd0lAAAAAASvFfDZFWgtbzFSS9Y3so8rHJth';
