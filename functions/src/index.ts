import { setGlobalOptions } from 'firebase-functions';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { parse as hjsonParse } from 'hjson';

const firebaseConfig = hjsonParse(process.env.VITE_FIREBASE_CONFIG ?? '{}');
const BUCKET: string = firebaseConfig.storageBucket;

admin.initializeApp();
setGlobalOptions({ maxInstances: 5 });
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const SCREEN_RECORDING_PATH = /^[^/]+\/screenRecording\//;
function isPreconditionFailure(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 412;
}

export const convertScreenRecording = onObjectFinalized(
  {
    bucket: BUCKET, memory: '1GiB', timeoutSeconds: 60, maxInstances: 10,
  },
  async (event) => {
    const { name: filePath, generation, metadata } = event.data;

    if (!SCREEN_RECORDING_PATH.test(filePath)) return;

    // Prevent re-trigger loop: uploading back to the same path fires onObjectFinalized again
    if (metadata?.converted === 'true') {
      logger.info(`Skipping already-converted: ${filePath}`);
      return;
    }

    const bucket = admin.storage().bucket(BUCKET);
    const sourceFile = bucket.file(filePath, { generation });
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screen-recording-'));
    const fileName = path.basename(filePath);
    const tmpInput = path.join(tempDir, fileName);
    const tmpOutput = path.join(tempDir, `${fileName}.tmp`);

    try {
      logger.info(`Downloading ${filePath}`);
      await sourceFile.download({ destination: tmpInput });
      const [sourceMetadata] = await sourceFile.getMetadata();

      logger.info('Converting to webm');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpInput)
          .outputOptions('-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-f', 'webm')
          .output(tmpOutput)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      logger.info(`Uploading ${filePath}`);
      await bucket.upload(tmpOutput, {
        destination: filePath,
        preconditionOpts: { ifGenerationMatch: generation },
        metadata: {
          contentType: 'video/webm',
          metadata: { ...sourceMetadata.metadata, converted: 'true' },
        },
      });

      logger.info(`Done: ${filePath}`);
    } catch (err) {
      if (isPreconditionFailure(err)) {
        logger.info(`Skipping stale recording event: ${filePath}`);
        return;
      }
      logger.error(`Conversion failed for ${filePath}`, err);
      throw err;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  },
);
