git # FINAL IMPLEMENTATION PLAN – Linear support in `vibe-tools` CLI  
This consolidated plan merges the original and updated versions, incorporating full OAuth2 (PKCE) support, correct identifier handling in GraphQL, and alignment with ClickUp/GitHub patterns.

---

## PHASE 0  — Recon & Preparation  
Files to skim (no edits)  
• `src/commands/clickup/**` – single-token pattern  
• `src/commands/github/**`   – multi-strategy auth & good UX messages  
• `src/utils/installUtils.ts` – `writeKeysToFile`, env helpers  
• `src/config.ts`             – `loadEnv()` & Doppler integration  
• `local-research/*linear*`   – API & GraphQL notes  

---

## PHASE 1  — Command Skeleton  
Files:  
• NEW `src/commands/linear.ts` (dispatcher)  
• MODIFY `src/commands/index.ts` (register `linear`)  

Dispatcher code:
```ts
import type { Command, CommandGenerator, CommandMap, CommandOptions } from '../types';
import { ConnectCommand } from './linear/connect';
import { IssueCommand }   from './linear/issue';

export class LinearCommand implements Command {
  private subcommands: CommandMap = {
    connect:    new ConnectCommand(),
    'get-issue': new IssueCommand(),      // exact name requested
    issue:      new IssueCommand(),       // alias for consistency with other integrations
  };

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [sub, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');
    if (!sub) {
      yield 'Please specify a subcommand: connect, get-issue';
      return;
    }
    const cmd = this.subcommands[sub];
    if (cmd) {
      yield* cmd.execute(subQuery, options);
    } else {
      yield `Unknown subcommand: ${sub}. Available: connect, get-issue`;
    }
  }
}
```

Registry modification:
```diff
+ import { LinearCommand } from './linear';
  ...
  export const commands: CommandMap = {
    ...
+   linear: new LinearCommand(),
  };
```

---

## PHASE 2  — Authentication Module  
Files:  
• NEW `src/commands/linear/linearAuth.ts`

```ts
import { loadEnv } from '../../config';

const TOKEN_ENV = 'LINEAR_API_KEY';           // Access- or Personal-token
const CLIENT_ID_ENV = 'LINEAR_CLIENT_ID';     // For OAuth flow reuse
const CLIENT_SECRET_ENV = 'LINEAR_CLIENT_SECRET';

export function getLinearToken(): string | undefined {
  loadEnv();
  return process.env[TOKEN_ENV];
}

export function getLinearHeaders(extra?: Record<string,string>) {
  const token = getLinearToken();
  if (!token) {
    throw new Error(
      'No Linear access token found. Run `vibe-tools linear connect` first.'
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/* Small helper exported for OAuth exchange */
export async function saveLinearToken(token: string, scope: 'local'|'global') {
  const { writeKeysToFile, LOCAL_ENV_PATH, VIBE_HOME_ENV_PATH } =
      await import('../../utils/installUtils');
  const path = scope === 'local' ? LOCAL_ENV_PATH : VIBE_HOME_ENV_PATH;
  writeKeysToFile(path, { [TOKEN_ENV]: token });
}
```

---

## PHASE 3  — `linear connect` (API Key + OAuth PKCE)  
Files:  
• NEW `src/commands/linear/connect.ts`

```ts
import crypto from 'node:crypto';
import http from 'node:http';
import { URLSearchParams } from 'node:url';
import { open } from 'open';
import { consola } from 'consola';
import type { Command, CommandGenerator } from '../../types';
import { writeKeysToFile, VIBE_HOME_ENV_PATH, LOCAL_ENV_PATH } from '../../utils/installUtils';
import { saveLinearToken } from './linearAuth';

const REDIRECT_URI = 'http://localhost:53682/callback';

export class ConnectCommand implements Command {
  async *execute(): CommandGenerator {
    const method = await consola.prompt(
      'Choose auth method',
      { type: 'select',
        options: [ {label:'Personal API Key', value:'key'},
                   {label:'OAuth (browser login)', value:'oauth'} ] }
    );

    if (method === 'key') {
      yield* this.handleApiKey();
      return;
    }
    yield* this.handleOAuth();
  }

  private async *handleApiKey(): CommandGenerator {
    const hasKey = await consola.prompt(
      'Do you already have a Linear personal API key? (y/n)',
      { type: 'confirm' }
    );

    let apiKey: string | undefined;

    if (hasKey) {
      apiKey = await consola.prompt('Paste your Linear API key', { type: 'text' });
    } else {
      consola.info(
        'Opening Linear in your default browser to create a personal API key (Settings → API Keys)...'
      );
      await import('open').then(({ default: open }) =>
        open('https://linear.app/settings/api')
      );
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
          { label: 'Global',  value: 'global' },
        ],
      }
    );

    const targetPath = scope === 'local' ? LOCAL_ENV_PATH : VIBE_HOME_ENV_PATH;
    writeKeysToFile(targetPath, { LINEAR_API_KEY: apiKey });

    yield `Saved LINEAR_API_KEY to ${targetPath}\n`;
    yield '✔ Linear authentication configured.';
  }

  private async *handleOAuth(): CommandGenerator {
    const clientId = process.env.LINEAR_CLIENT_ID ||
      await consola.prompt('Linear OAuth Client ID', { type:'text' });
    const clientSecret = process.env.LINEAR_CLIENT_SECRET ||
      await consola.prompt('Linear OAuth Client Secret', { type:'password' });

    // PKCE
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256')
       .update(verifier).digest('base64url');

    const authUrl = new URL('https://linear.app/oauth/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      scope: 'read',   // broaden if needed
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    consola.info('Opening browser for OAuth…');
    await open(authUrl.toString());

    // Tiny local server
    const code: string = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url ?? '', REDIRECT_URI);
        const code = u.searchParams.get('code');
        res.end('Authentication successful! You can close this tab.');
        server.close();
        if (code) resolve(code); else reject(new Error('No code in redirect'));
      }).listen(53682);
    });

    // Token exchange
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    const res = await fetch('https://api.linear.app/oauth/token', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.statusText}`);
    const json = await res.json() as {access_token:string};
    await saveLinearToken(json.access_token, 'global');
    yield '✅ OAuth successful – token stored as LINEAR_API_KEY';
  }
}
```

---

## PHASE 4  — Utility Helpers (optional)  
Files:  
• NEW `src/commands/linear/utils.ts`

```ts
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString();

export const stripMarkdown = (text?: string) =>
  (text ?? '').trim() || '—';
```

---

## PHASE 5  — `linear get-issue` (identifier fix)  
Files:  
• NEW `src/commands/linear/issue.ts`

```ts
import type { Command, CommandGenerator } from '../../types';
import { getLinearHeaders } from './linearAuth';
import { formatDate, stripMarkdown } from './utils';

interface LinearIssue {
  identifier: string;
  title: string;
  description: string;
  state?: { name: string };
  assignee?: { name: string };
  creator?: { name: string };
  priority: number;
  createdAt: string;
  updatedAt: string;
  comments?: { nodes: LinearComment[] };
  attachments?: { nodes: LinearAttachment[] };
}
interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  user?: { name: string };
}
interface LinearAttachment {
  id: string;
  title: string;
  url: string;
  uploadedBy?: { name: string };
}

export class IssueCommand implements Command {
  private API = 'https://api.linear.app/graphql';

  private async query<T>(query: string, vars: Record<string, any>): Promise<T> {
    const res = await fetch(this.API, {
      method: 'POST',
      headers: getLinearHeaders(),
      body: JSON.stringify({ query, variables: vars }),
    });
    if (!res.ok) {
      throw new Error(`Linear API error ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(JSON.stringify(json.errors));
    }
    return json.data;
  }

  private async resolveIdentifier(identifier: string): Promise<string | null> {
    const match = identifier.match(/^([A-Z]+)-(\d+)$/);
    if (!match) return identifier;               // looks like uuid
    const [, teamKey, numberStr] = match;
    const query = `
      query Q($teamKey:String!, $number:Float!) {
        team(key:$teamKey) {
          id
          issues(filter:{ number:{ eq:$number }}) { nodes { id } }
        }
      }`;
    const data = await this.query<{ team: { issues:{nodes:{id:string}[]} }|null }>
                               (query, {teamKey, number: Number(numberStr)});
    return data.team?.issues.nodes[0]?.id ?? null;
  }

  async *execute(raw: string): CommandGenerator {
    const arg = raw.trim();
    if (!arg) { yield 'Usage: vibe-tools linear get-issue <identifier|id>'; return; }

    yield `Resolving ${arg} …\n`;
    const id = await this.resolveIdentifier(arg);
    if (!id) { yield 'Issue not found.\n'; return; }

    const q = `
      query Get($id:String!) {
        issue(id:$id) { ...fullFields }
      }
      fragment fullFields on Issue {
        id identifier title description state {name}
        assignee {name} creator {name}
        priority createdAt updatedAt
        comments { nodes { id body createdAt user {name} } }
        attachments { nodes { id title url uploadedBy {name} } }
      }`;
    const data = await this.query<{issue:LinearIssue|null}>(q,{id});
    const issue = data.issue;
    if (!issue) {
      yield `Linear issue ${arg} not found.\n`;
      return;
    }

    // Header
    yield `## ${issue.identifier} – ${issue.title}\n`;
    yield `Status: ${issue.state?.name ?? 'N/A'}\n`;
    yield `Priority: ${issue.priority}\n\n`;

    // Description
    yield `### Description\n${stripMarkdown(issue.description)}\n\n`;

    // Comments
    const comments = issue.comments?.nodes ?? [];
    if (comments.length) {
      yield `### Comments (${comments.length})\n`;
      for (const c of comments) {
        yield `* **${c.user?.name ?? 'Unknown'}** on ${formatDate(c.createdAt)}\n`;
        yield `  > ${stripMarkdown(c.body)}\n`;
      }
      yield '\n';
    }

    // Attachments
    const attachments = issue.attachments?.nodes ?? [];
    if (attachments.length) {
      yield `### Attachments (${attachments.length})\n`;
      for (const a of attachments) {
        yield `* [${a.title}](${a.url}) — uploaded by ${a.uploadedBy?.name ?? 'unknown'}\n`;
      }
      yield '\n';
    }

    // Meta
    yield `---\n`;
    yield `Assignee: ${issue.assignee?.name ?? 'Unassigned'}\n`;
    yield `Creator: ${issue.creator?.name ?? 'Unknown'}\n`;
    yield `Created: ${formatDate(issue.createdAt)}\n`;
    yield `Updated: ${formatDate(issue.updatedAt)}\n`;
  }
}
```

---

## PHASE 6  — Docs & Cheat-Sheet  
Files:  
• MODIFY `src/vibe-rules.ts` – add **Linear Information** section.

```diff
- **ClickUp Information:**
+ **Linear Information:**
+ `vibe-tools linear connect` – configure authentication for Linear.
+ `vibe-tools linear get-issue <id>` – display Linear issue details.
```

---

## PHASE 7  — Testing  
1. Manual  
   ```bash
   vibe-tools linear connect            # test both paths
   vibe-tools linear get-issue LIN-123
   vibe-tools linear get-issue 94baa0d6-…  # uuid form
   ```

2. Regression/error cases  
• Invalid client ID / port busy / unauthenticated fetch.  
• Identifier not found.  
• Expired token (returns 401) → ensure error surfaced.

3. (Optional) Jest tests  
• Mock fetch for `resolveIdentifier` & full query.  
• Unit-test `getLinearHeaders()` w/ and w/o token.

---

## PHASE 8  — Future Enhancements  
• Token refresh for OAuth (Linear returns `expires_in` + `refresh_token`).  
• More sub-commands (`my-issues`, `create`, `project`).  
• Swap raw HTTP for `@linear/sdk` if bundle size OK.

---

## FILE-LEVEL CHECKLIST

| Phase | Action | Path |
|-------|--------|------|
| 1 | New | `src/commands/linear.ts` |
| 1 | Modify | `src/commands/index.ts` |
| 2 | New | `src/commands/linear/linearAuth.ts` |
| 3 | New | `src/commands/linear/connect.ts` |
| 4 | New | `src/commands/linear/utils.ts` |
| 5 | New | `src/commands/linear/issue.ts` |
| 6 | Modify | `src/vibe-rules.ts` |

--- End Plan --- 