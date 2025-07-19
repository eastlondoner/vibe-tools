import { loadEnv } from '../../config';

const TOKEN_ENV = 'LINEAR_API_KEY'; // Access- or Personal-token

export function getLinearToken(): string | undefined {
  loadEnv();
  return process.env[TOKEN_ENV];
}

export function getLinearHeaders(extra?: Record<string, string>) {
  const token = getLinearToken();
  if (!token) {
    throw new Error('No Linear access token found. Run `vibe-tools linear connect` first.');
  }
  return {
    Authorization: token,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/* Small helper exported for OAuth exchange */
export async function saveLinearToken(token: string, scope: 'local' | 'global') {
  const { writeKeysToFile, LOCAL_ENV_PATH, VIBE_HOME_ENV_PATH } = await import(
    '../../utils/installUtils'
  );
  const path = scope === 'local' ? LOCAL_ENV_PATH : VIBE_HOME_ENV_PATH;
  writeKeysToFile(path, { [TOKEN_ENV]: token });
}
