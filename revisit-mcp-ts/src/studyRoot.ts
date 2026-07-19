import path from 'path';
import fs from 'fs/promises';

// Resolve the Revisit study repo root (this package lives at <root>/revisit-mcp-ts).
export const STUDY_ROOT = path.resolve(__dirname, '..', '..');

export async function readStudyFile(...segments: string[]): Promise<string> {
  return fs.readFile(path.resolve(STUDY_ROOT, ...segments), 'utf-8');
}
