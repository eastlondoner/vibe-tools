Querying perplexity using sonar-pro for: Provide a comprehensive guide on integrating with Linear API, including authentication via API key and OAuth, and GraphQL queries to fetch a specific issue by identifier with all details, comments, and attachment URLs. Include code examples in TypeScript if possible. with maxTokens: 21000
Here’s a comprehensive guide to integrating with the **Linear API** using both TypeScript examples and GraphQL details, including authentication (API key & OAuth), as well as code snippets to fetch detailed issue data (comments, attachments, etc.).

---

## 1. Authentication Methods

**Linear supports two main authentication options:**

- **Personal API Key**: Best for personal scripts and internal tools.
- **OAuth2**: Recommended for applications used by others (multi-user apps)[5][4].

### Using the TypeScript SDK (`@linear/sdk`)

```typescript
import { LinearClient } from "@linear/sdk";

// API Key authentication
const clientApiKey = new LinearClient({ apiKey: "YOUR_PERSONAL_API_KEY" });

// OAuth2 authentication (accessToken from OAuth flow)
const clientOAuth = new LinearClient({ accessToken: "YOUR_OAUTH_ACCESS_TOKEN" });
```
[1][2]

### Using Raw HTTP (fetch or axios)

**For API Key:**
- Add `Authorization: <YOUR_API_KEY>` header.

**For OAuth2:**
- Add `Authorization: Bearer <ACCESS_TOKEN>` header.

Example with axios:
```typescript
import axios from "axios";

const res = await axios.post(
  "https://api.linear.app/graphql",
  { query: "..." },
  {
    headers: {
      "Authorization": "YOUR_PERSONAL_API_KEY", // Or "Bearer YOUR_ACCESS_TOKEN"
      "Content-Type": "application/json",
    }
  }
);
```
[3][5]

---

## 2. Fetching a Specific Issue (All Details, Comments, Attachments)

### GraphQL Query Structure

To fetch *all details of a specific issue* (by its identifier, e.g., `LIN-123`), including its comments and attachment URLs, you would use a GraphQL query like this:

```graphql
query GetIssueWithDetails($issueId: String!) {
  issue(id: $issueId) {
    id
    identifier
    title
    description
    state {
      name
    }
    assignee {
      id
      name
      email
    }
    creator {
      id
      name
      email
    }
    priority
    createdAt
    updatedAt

    comments {
      nodes {
        id
        body
        createdAt
        user {
          id
          name
        }
      }
    }

    attachments {
      nodes {
        id
        url
        title
        uploadedBy {
          id
          name
        }
      }
    }
  }
}
```
[5]

#### Not all fields may be needed—customize for your use case.

---

### Code Example: TypeScript with the Linear SDK

The **Linear SDK** provides a type-safe way to access issue details:

```typescript
import { LinearClient } from "@linear/sdk";

// Assumes 'client' is already authenticated
async function getIssueWithDetails(identifier: string) {
  // Find by identifier (e.g., "LIN-123")
  const [teamKey, numberStr] = identifier.split("-");
  const number = Number(numberStr);

  // The SDK does not directly offer search by identifier, so fetch via team and number
  const teams = await client.teams();
  const team = teams.nodes.find(t => t.key === teamKey);

  if (!team) throw new Error("Team not found");

  const issues = await team.issues({ filter: { number: { eq: number } } });
  const issue = issues.nodes[0];

  if (!issue) throw new Error("Issue not found");

  // Load comments and attachments
  const comments = await issue.comments();
  const attachments = await issue.attachments();

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    state: issue.state?.name,
    assignee: issue.assignee?.name,
    creator: issue.creator?.name,
    priority: issue.priority,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    comments: comments.nodes.map(c => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      user: c.user?.name,
    })),
    attachments: attachments.nodes.map(a => ({
      id: a.id,
      url: a.url,
      title: a.title,
      uploadedBy: a.uploadedBy?.name,
    })),
  };
}
```
[1][2]

---

### Code Example: Raw GraphQL Request (axios)

```typescript
import axios from "axios";

const issueId = "ISSUE_ID_OR_IDENTIFIER"; // Use the Linear issue ID; for identifier, see note below

const query = `
  query GetIssueWithDetails($issueId: String!) {
    issue(id: $issueId) {
      id
      identifier
      title
      description
      comments { nodes { id body createdAt user { name } } }
      attachments { nodes { url title } }
    }
  }
`;

// If you only have the identifier (e.g., "LIN-123"), you need to query for the issue ID first, usually by listing issues for the team and matching the number.

const variables = { issueId };

const res = await axios.post("https://api.linear.app/graphql", {
  query,
  variables,
}, {
  headers: {
    Authorization: "YOUR_PERSONAL_API_KEY",
    "Content-Type": "application/json"
  }
});

console.log(res.data.data.issue);
```
[3][5]

---

## 3. Additional Resources and Tips

- The Linear Typescript SDK handles most common queries in an idiomatic, type-safe way[1][2][4].
- For identifier-based fetches, you may need to split the identifier and look up by `team.key` and `issue.number` if only the identifier string is known.
- All GraphQL fields and schema options are available through introspection at https://api.linear.app/graphql[5].
- Attachments, comments, and other nested data are accessed via nested `nodes` arrays in the response.

---

**Summary Table: Authentication & API Usage**

| Method        | Header Example                      | Client Setup Example                |
|--------------|-------------------------------------|-------------------------------------|
| API Key      | Authorization: <API_KEY>            | new LinearClient({apiKey: ...})     |
| OAuth2       | Authorization: Bearer <ACCESS_TOKEN>| new LinearClient({accessToken: ...})|

Linear’s documentation provides further samples and advanced usage patterns[1][4][5].