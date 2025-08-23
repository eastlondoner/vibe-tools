Packing repository using Repomix...
Analyzing repository using gemini-2.5-flash...
The `vibe-tools` codebase provides well-structured integrations for external services like ClickUp and GitHub, serving as excellent patterns for new command implementations.

### Existing Integrations Analysis

#### ClickUp Integration (`src/commands/clickup/`)

**Relevant Files:**
*   `src/commands/clickup.ts`: Main entry point for `clickup` commands. It dispatches to subcommands.
*   `src/commands/clickup/clickupAuth.ts`: Handles authentication-related logic.
*   `src/commands/clickup/task.ts`: Implements the `task` subcommand for fetching ClickUp task details.
*   `src/commands/clickup/utils.ts`: Contains utility functions for formatting and options.

**Authentication Implementation:**
Authentication for ClickUp is straightforward, relying on a single API token.
*   `getClickUpToken()`: Retrieves the `CLICKUP_API_TOKEN` environment variable.
*   `getClickUpHeaders()`: Constructs the `Authorization` header (`Authorization: <token>`) and `Content-Type: application/json`. It throws an error if `CLICKUP_API_TOKEN` is not set, ensuring clear error messages to the user.

**Command Handling Implementation:**
The `ClickUpCommand` class (`src/commands/clickup.ts`) acts as a dispatcher for subcommands.
*   It exposes a `subcommands` map, currently containing only `task: new TaskCommand()`.
*   The `execute` method parses the command line input to identify the subcommand and its arguments, then delegates to the appropriate handler.
The `TaskCommand` (`src/commands/clickup/task.ts`) implements the actual logic:
*   It fetches a ClickUp task by ID using `fetch` with the headers from `clickupAuth.ts`.
*   It then fetches comments for that task.
*   The fetched data is formatted and yielded as Markdown output, including task details, description, comments, assignees, tags, and priority.
*   Error handling includes checking `response.ok` and providing specific messages for 404 (Task not found) and 401 (Authentication failed).

#### GitHub Integration (`src/commands/github/`)

**Relevant Files:**
*   `src/commands/github.ts`: Main entry point for `github` commands, dispatching to `pr` and `issue`.
*   `src/commands/github/githubAuth.ts`: Manages various GitHub authentication methods.
*   `src/commands/github/issue.ts`: Implements the `issue` subcommand for fetching GitHub issue details.
*   `src/commands/github/pr.ts`: Implements the `pr` subcommand for fetching GitHub pull request details.
*   `src/commands/github/utils.ts`: Provides utility functions, notably `getRepoContext` for determining the repository.

**Authentication Implementation:**
GitHub authentication is more robust, supporting multiple methods to maximize user convenience and API rate limits.
*   `isGitHubCliAvailable()`: Checks for the presence and login status of the `gh` CLI.
*   `getGitCredentials()`: Attempts to retrieve credentials from `git credential fill`, supporting `GITHUB_TOKEN`-like strings from git config.
*   `getGitHubToken()`: Prioritizes fetching the token from `process.env.GITHUB_TOKEN`, then `gh auth token`, falling back to `getGitCredentials()` if the password from git looks like a GitHub token (e.g., starts with `ghp_` or `gho_`).
*   `getGitHubHeaders()`: Constructs the `Authorization` header using the obtained token (Bearer token) or falls back to Basic Auth using git credentials if no token is found.
This multi-pronged approach ensures authentication is attempted via the most common and secure methods automatically.

**Command Handling Implementation:**
Similar to ClickUp, `GithubCommand` (`src/commands/github.ts`) acts as a dispatcher for `pr` and `issue` subcommands.
*   `src/commands/github/issue.ts` and `src/commands/github/pr.ts` both implement the `Command` interface.
*   They first call `getRepoContext()` from `github/utils.ts` to infer the `owner/repo` from the current Git repository or from `--from-github`/`--repo` options.
*   They fetch data (list or specific details) using `fetch` with headers from `githubAuth.ts`.
*   Output is formatted in Markdown, including extensive details like issue/PR body, comments, review comments (for PRs, grouped by file), labels, assignees, and milestones.
*   Robust error handling is present, specifically for 404 (not found), 403 (rate limits, with suggestions for authentication), and general API errors. They also provide a helpful note if no authentication is found.

### Suggested Structure for a New 'linear' Command

Based on the patterns observed in ClickUp and GitHub integrations, here's how a new `linear` command would be structured:

#### 1. Core Command File (`src/commands/linear.ts`)

This file would serve as the main dispatcher, similar to `src/commands/clickup.ts` and `src/commands/github.ts`.

```typescript
// src/commands/linear.ts
import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../../types';
import { IssueCommand } from './linear/issue'; // For handling Linear issues
// import { ProjectCommand } from './linear/project'; // For handling Linear projects (future)

export class LinearCommand implements Command {
  private subcommands: CommandMap = {
    issue: new IssueCommand(),
    // project: new ProjectCommand(), // Add if needed
  };

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    if (!subcommand) {
      yield 'Please specify a subcommand: issue'; // List available subcommands
      return;
    }

    if (this.subcommands[subcommand]) {
      yield* this.subcommands[subcommand].execute(subQuery, options);
    } else {
      yield `Unknown subcommand: ${subcommand}. Available subcommands: issue`;
    }
  }
}
```

#### 2. Authentication Module (`src/commands/linear/linearAuth.ts`)

This module would manage Linear API key retrieval and header construction.

```typescript
// src/commands/linear/linearAuth.ts
import { loadEnv } from '../../config';

/**
 * Get Linear API token from environment.
 */
export function getLinearToken(): string | undefined {
  loadEnv(); // Ensure environment variables are loaded
  return process.env.LINEAR_API_KEY;
}

/**
 * Get Linear authentication headers for API requests.
 */
export function getLinearHeaders(): Record<string, string> {
  const token = getLinearToken();
  if (!token) {
    throw new Error(
      'LINEAR_API_KEY environment variable is not set. Please set it in your .vibe-tools/.env file.'
    );
  }
  return {
    Authorization: `Bearer ${token}`, // Linear uses "Bearer" for API keys as per research
    'Content-Type': 'application/json',
  };
}
```

#### 3. Subcommand Implementations (`src/commands/linear/issue.ts`)

Each subcommand (e.g., `issue`, `project`) would have its own file, implementing the `Command` interface. Given Linear's GraphQL API, the `fetch` requests would differ slightly from ClickUp's REST or GitHub's mixed approach.

```typescript
// src/commands/linear/issue.ts
import type { Command, CommandGenerator } from '../../types';
import { getLinearHeaders } from './linearAuth';
// Add utility functions if needed, e.g., for GraphQL query formatting
// import { formatLinearDate, formatLinearStatus } from './utils';

export class IssueCommand implements Command {
  private API_URL = 'https://api.linear.app/graphql';

  private async executeGraphQLQuery(query: string, variables: Record<string, any>): Promise<any> {
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: getLinearHeaders(),
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Linear API Error: ${response.status} - ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`Linear GraphQL Error: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
  }

  async *execute(query: string): CommandGenerator {
    const issueIdentifier = query.trim(); // e.g., "LIN-123"

    if (!issueIdentifier) {
      yield 'Please specify a Linear issue identifier (e.g., vibe-tools linear issue "LIN-123")';
      return;
    }

    // Example GraphQL query to fetch issue details, comments, and attachments
    // (Based on linear-api-research.md)
    const graphqlQuery = `
      query GetIssueWithDetails($issueIdentifier: String!) {
        issue(id: $issueIdentifier) {
          id
          identifier
          title
          description
          state { name }
          assignee { id name email }
          creator { id name email }
          priority
          createdAt
          updatedAt
          comments {
            nodes {
              id body createdAt user { name }
            }
          }
          attachments {
            nodes {
              id url title uploadedBy { name }
            }
          }
        }
      }
    `;

    try {
      yield `Fetching Linear issue ${issueIdentifier}...\n`;
      const data = await this.executeGraphQLQuery(graphqlQuery, { issueIdentifier });
      const issue = data.issue;

      if (!issue) {
        yield `Linear Issue Error: Issue ${issueIdentifier} not found.`;
        return;
      }

      // Format and yield output similar to GitHub/ClickUp
      yield `## Issue: ${issue.identifier} - ${issue.title}\n`;
      yield `Status: ${issue.state?.name || 'N/A'}\n`;
      yield `Priority: ${issue.priority || 'N/A'}\n`;
      yield `Description:\n${issue.description || 'No description provided.'}\n\n`;

      if (issue.comments?.nodes?.length > 0) {
        yield `### Comments (${issue.comments.nodes.length})\n`;
        for (const comment of issue.comments.nodes) {
          yield `  - @${comment.user?.name || 'Unknown'} on ${new Date(comment.createdAt).toLocaleString()}:\n`;
          yield `    ${comment.body || 'No content'}\n`;
        }
        yield '\n';
      }

      if (issue.attachments?.nodes?.length > 0) {
        yield `### Attachments (${issue.attachments.nodes.length})\n`;
        for (const attachment of issue.attachments.nodes) {
          yield `  - ${attachment.title || 'Untitled Attachment'}: ${attachment.url}\n`;
        }
        yield '\n';
      }

      // Add more metadata as needed
      yield `Assignee: ${issue.assignee?.name || 'Unassigned'}\n`;
      yield `Created by: ${issue.creator?.name || 'Unknown'}\n`;
      yield `Created at: ${new Date(issue.createdAt).toLocaleString()}\n`;
      yield `Last updated: ${new Date(issue.updatedAt).toLocaleString()}\n`;

    } catch (error) {
      yield `Error fetching Linear issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
```

#### 4. Utility Module (`src/commands/linear/utils.ts`)

This optional module would hold shared helper functions, similar to `clickup/utils.ts` and `github/utils.ts`. For Linear, this might include date formatting specific to its timestamps or perhaps functions to construct more complex GraphQL fragments.

#### 5. Integration into Main Commands (`src/commands/index.ts`)

Finally, the new `LinearCommand` needs to be added to the global `commands` map:

```typescript
// src/commands/index.ts (excerpt)
import { LinearCommand } from './linear'; // New import

export const commands: CommandMap = {
  // ... existing commands
  linear: new LinearCommand(), // Add the new command
};
```

This structure provides a clear separation of concerns, reuses existing patterns for dispatching and authentication, and adapts to Linear's GraphQL API, setting up a solid foundation for further Linear-specific functionalities.

---

**Files Most Relevant to the User's Query:**

*   `src/commands/clickup.ts`
*   `src/commands/clickup/clickupAuth.ts`
*   `src/commands/clickup/task.ts`
*   `src/commands/clickup/utils.ts`
*   `src/commands/github.ts`
*   `src/commands/github/githubAuth.ts`
*   `src/commands/github/issue.ts`
*   `src/commands/github/pr.ts`
*   `src/commands/github/utils.ts`
*   `local-research/linear-api-research.md`