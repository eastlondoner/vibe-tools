import alchemy from 'alchemy';
import { Exec } from 'alchemy/os';
import {
  Assets,
  Worker,
  Pipeline,
  R2Bucket,
  WranglerJson,
  AccountApiToken,
} from 'alchemy/cloudflare';
import fs from 'fs/promises';
import path from 'path';
import { createBucketResourceIds } from './alchemy-utils';

const STATIC_ASSETS_PATH = './.output/public/';
const R2_BUCKET_NAME = 'vibe-tools-telemetry';
const PIPELINE_NAME = 'vibe-tools-telemetry';
const WORKER_NAME = 'vibe-tools-infra';
const TELEMETRY_FILE_PATH = path.resolve(__dirname, '../../src/telemetry/index.ts'); // Use absolute path

const app = await alchemy('vibe-tools-infra', {
  stage: 'dev',
  phase: process.argv.includes('--destroy') ? 'destroy' : 'up',
  quiet: process.argv.includes('--verbose') ? false : true,
  password: process.env.ALCHEMY_PASS,
});

await Exec('build', {
  command: 'bun run build',
});

const staticAssets = await Assets('static-assets', {
  path: STATIC_ASSETS_PATH,
});

// Create the R2 bucket
const bucket = await R2Bucket('bucket', {
  name: R2_BUCKET_NAME,
});

// Create the Account API token for the bucket
// see https://developers.cloudflare.com/r2/api/tokens/
const storageToken = await AccountApiToken('telemetry-pipeline-r2-access-token', {
  name: 'alchemy-account-access-token',
  policies: [
    {
      effect: 'allow',
      permissionGroups: ['Workers R2 Storage Bucket Item Write'],
      resources: createBucketResourceIds(bucket),
    },
  ],
});

// Create the pipeline
const pipeline = await Pipeline('pipeline', {
  name: PIPELINE_NAME,
  source: [{ type: 'binding', format: 'json' }],
  destination: {
    type: 'r2',
    format: 'json',
    path: {
      bucket: bucket.name,
    },
    credentials: {
      accessKeyId: storageToken.accessKeyId,
      secretAccessKey: storageToken.secretAccessKey,
    },
    batch: {
      maxMb: 10,
      maxSeconds: 5,
      maxRows: 100,
    },
  },
});

// Create the worker
export const worker = await Worker('worker', {
  name: WORKER_NAME,
  entrypoint: './app/index.ts',
  url: true,
  bindings: {
    ASSETS: staticAssets,
    R2_BUCKET: bucket,
    PIPELINE: pipeline,
  },
});

console.log({
  url: worker.url,
});

if (worker.url) {
  const newEndpoint = `${worker.url}/api/pipeline`;
  try {
    // Read the telemetry file
    let telemetryContent = await fs.readFile(TELEMETRY_FILE_PATH, 'utf-8');

    // Replace the endpoint line
    telemetryContent = telemetryContent.replace(
      /^const TELEMETRY_ENDPOINT = .*;/m, // Match the whole line
      `const TELEMETRY_ENDPOINT = '${newEndpoint}';`
    );

    // Write the updated content back
    await fs.writeFile(TELEMETRY_FILE_PATH, telemetryContent, 'utf-8');

    // check that the new endpoint is in the file
    const updatedTelemetryContent = await fs.readFile(TELEMETRY_FILE_PATH, 'utf-8');
    if (!updatedTelemetryContent.includes(newEndpoint)) {
      throw new Error('Failed to update TELEMETRY_ENDPOINT in src/telemetry/index.ts');
    }

    console.log(`Successfully updated TELEMETRY_ENDPOINT in ${TELEMETRY_FILE_PATH}`);
  } catch (err) {
    console.error('Error updating telemetry file:', err);
  }
} else {
  console.warn('Worker URL not available, skipping update of src/telemetry/index.ts');
}

await WranglerJson('config', {
  worker,
});

await app.finalize();
