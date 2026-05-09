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
const WEBM_COMPATIBLE_CODECS = new Set(['vp8', 'vp9', 'av1', 'opus', 'vorbis']);

function isWebmCopyCompatible(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        resolve(false);
        return;
      }
      const streams = metadata.streams ?? [];
      resolve(streams.every((s) => !s.codec_name || WEBM_COMPATIBLE_CODECS.has(s.codec_name)));
    });
  });
}

export const convertScreenRecording = onObjectFinalized(
  {
    bucket: BUCKET, memory: '1GiB', timeoutSeconds: 60, maxInstances: 10,
  },
  async (event) => {
    const filePath = event.data.name;

    if (!SCREEN_RECORDING_PATH.test(filePath)) return;

    // Prevent re-trigger loop: uploading back to the same path fires onObjectFinalized again
    if (event.data.metadata?.converted === 'true') {
      logger.info(`Skipping already-converted: ${filePath}`);
      return;
    }

    const fileName = path.basename(filePath);
    const tmpInput = path.join(os.tmpdir(), fileName);
    const tmpOutput = path.join(os.tmpdir(), `${fileName}.tmp`);
    const bucket = admin.storage().bucket(BUCKET);

    try {
      logger.info(`Downloading ${filePath}`);
      await bucket.file(filePath).download({ destination: tmpInput });

      if (!await isWebmCopyCompatible(tmpInput)) {
        logger.info(`Skipping: codecs not compatible with WebM stream copy: ${filePath}`);
        return;
      }

      logger.info('Converting to webm');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpInput)
          .outputOptions('-c', 'copy', '-f', 'webm')
          .output(tmpOutput)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      logger.info(`Uploading ${filePath}`);
      await bucket.upload(tmpOutput, {
        destination: filePath,
        metadata: { contentType: 'video/webm', metadata: { converted: 'true' } },
      });

      logger.info(`Done: ${filePath}`);
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
