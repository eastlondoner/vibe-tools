import crypto from 'node:crypto';
import http from 'node:http';
import { URLSearchParams } from 'node:url';
import open from 'open';
import { consola } from 'consola';
import type { Command, CommandGenerator } from '../../types';
import { writeKeysToFile, VIBE_HOME_ENV_PATH, LOCAL_ENV_PATH } from '../../utils/installUtils';
import { saveLinearToken } from './linearAuth';

const REDIRECT_URI = 'http://localhost:53682/callback';

export class ConnectCommand implements Command {
  async *execute(): CommandGenerator {
    const method = await consola.prompt('Choose auth method', {
      type: 'select',
      options: [
        { label: 'Personal API Key', value: 'key' },
        { label: 'OAuth (browser login)', value: 'oauth' },
      ],
    });

    if (method === 'key') {
      yield* this.handleApiKey();
      return;
    }
    yield* this.handleOAuth();
  }

  private async *handleApiKey(): CommandGenerator {
    const hasKey = await consola.prompt('Do you already have a Linear personal API key? (y/n)', {
      type: 'confirm',
    });

    let apiKey: string | undefined;

    if (hasKey) {
      apiKey = await consola.prompt('Paste your Linear API key', { type: 'text' });
    } else {
      consola.info(
        'Opening Linear in your default browser to create a personal API key (Settings → API Keys)...'
      );
      await import('open').then((mod) => mod.default('https://linear.app/settings/api'));
      apiKey = await consola.prompt('Paste the newly generated API key', { type: 'text' });
    }

    if (!apiKey) {
      yield 'No key supplied – aborting.';
      return;
    }

    const scope = await consola.prompt(
      'Save key for this project only (.vibe-tools.env) or globally (~/.vibe-tools/.env)?',
      {
        type: 'select',
        options: [
          { label: 'Project', value: 'local' },
          { label: 'Global', value: 'global' },
        ],
      }
    );

    const targetPath = scope === 'local' ? LOCAL_ENV_PATH : VIBE_HOME_ENV_PATH;
    writeKeysToFile(targetPath, { LINEAR_API_KEY: apiKey });

    yield `Saved LINEAR_API_KEY to ${targetPath}\n`;
    yield '✔ Linear authentication configured.';
  }

  private async *handleOAuth(): CommandGenerator {
    const clientId =
      process.env.LINEAR_CLIENT_ID ||
      (await consola.prompt('Linear OAuth Client ID', { type: 'text' }));
    const clientSecret =
      process.env.LINEAR_CLIENT_SECRET ||
      (await consola.prompt('Linear OAuth Client Secret', { type: 'text' }));

    // PKCE
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    const authUrl = new URL('https://linear.app/oauth/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      scope: 'read', // broaden if needed
      client_id: String(clientId),
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    consola.info('Opening browser for OAuth…');
    await open(authUrl.toString());

    // Tiny local server
    const code: string = await new Promise((resolve, reject) => {
      const server = http
        .createServer((req, res) => {
          const u = new URL(req.url ?? '', REDIRECT_URI);
          const code = u.searchParams.get('code');
          res.end('Authentication successful! You can close this tab.');
          server.close();
          if (code) resolve(code);
          else reject(new Error('No code in redirect'));
        })
        .listen(53682);
    });

    // Token exchange
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: String(clientSecret),
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    const res = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.statusText}`);
    const json = (await res.json()) as { access_token: string };
    await saveLinearToken(json.access_token, 'global');
    yield '✅ OAuth successful – token stored as LINEAR_API_KEY';
  }
}
