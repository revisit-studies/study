import { setGlobalOptions } from 'firebase-functions';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { parse as hjsonParse } from 'hjson';

const firebaseConfig = hjsonParse(process.env.VITE_FIREBASE_CONFIG ?? '{}');
const BUCKET: string = firebaseConfig.storageBucket;

admin.initializeApp();
setGlobalOptions({ maxInstances: 5 });
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const SCREEN_RECORDING_PATH = /^[^/]+\/screenRecording\//;

export const convertScreenRecording = onObjectFinalized(
  {
    bucket: BUCKET, memory: '1GiB', timeoutSeconds: 60, maxInstances: 10,
  },
  async (event) => {
    const filePath = event.data.name;

    if (!SCREEN_RECORDING_PATH.test(filePath)) return;

    // Prevent re-trigger loop by skipping already-converted files
    if (filePath.endsWith('.webm')) {
      logger.info(`Skipping .webm: ${filePath}`);
      return;
    }

    const fileName = path.basename(filePath);
    const directory = path.dirname(filePath);
    const tmpInput = path.join(os.tmpdir(), fileName);
    const outputName = `${fileName}.webm`;
    const tmpOutput = path.join(os.tmpdir(), outputName);
    const outputStoragePath = `${directory}/${outputName}`;
    const bucket = admin.storage().bucket(BUCKET);

    try {
      logger.info(`Downloading ${filePath}`);
      await bucket.file(filePath).download({ destination: tmpInput });

      logger.info('Converting to webm');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpInput)
          .outputOptions('-c', 'copy')
          .output(tmpOutput)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      logger.info(`Uploading ${outputStoragePath}`);
      await bucket.upload(tmpOutput, {
        destination: outputStoragePath,
        metadata: { contentType: 'video/webm' },
      });

      logger.info(`Done: ${outputStoragePath}`);
    } catch (err) {
      logger.error(`Conversion failed for ${filePath}`, err);
      throw err;
    } finally {
      for (const f of [tmpInput, tmpOutput]) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch { /* ignore */ }
      }
    }
  },
);
