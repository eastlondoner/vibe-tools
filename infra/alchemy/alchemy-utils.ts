import { type R2Bucket, type TokenPolicy, createCloudflareApi } from 'alchemy/cloudflare';

// TODO: uncomment this when alchemy exports the AccountId
// import { AccountId } from "alchemy/cloudflare";

const cfAccountId = await createCloudflareApi().then((api) => api.accountId);

export function createBucketResourceIds(bucket: R2Bucket) {
  return {
    [`com.cloudflare.edge.r2.bucket.${cfAccountId}_default_${bucket.name}`]: '*',
    [`com.cloudflare.edge.r2.bucket.${cfAccountId}_eu_${bucket.name}`]: '*',
  } as TokenPolicy['resources'];
}
