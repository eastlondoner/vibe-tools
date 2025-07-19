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
}

export class IssueCommand implements Command {
  private API = 'https://api.linear.app/graphql';

  private async query<T>(query: string, vars: Record<string, any>): Promise<T> {
    const res = await fetch(this.API, {
      method: 'POST',
      headers: getLinearHeaders(),
      body: JSON.stringify({ query, variables: vars }),
    });
    
    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(`Linear API error ${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
    }
    
    if (json.errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
    }
    return json.data;
  }

  private async resolveIdentifier(identifier: string): Promise<string> {
    // Linear supports querying issues directly by identifier (ITE-123) or UUID
    // No resolution needed - just return the identifier as-is
    return identifier;
  }

  async *execute(raw: string): CommandGenerator {
    const arg = raw.trim();
    if (!arg) { yield 'Usage: vibe-tools linear get-issue <identifier|id>'; return; }

    yield `Fetching ${arg} …\n`;
    const id = await this.resolveIdentifier(arg);

    const q = `
      query Get($id:String!) {
        issue(id:$id) {
          id identifier title description state {name}
          assignee {name} creator {name}
          priority createdAt updatedAt
          comments { nodes { id body createdAt user {name} } }
          attachments { nodes { id title url } }
        }
      }`;
    const data = await this.query<{ issue: LinearIssue | null }>(q, { id });
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
        yield `* [${a.title}](${a.url})\n`;
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