Querying perplexity using sonar-pro for: Does the Linear GraphQL API support querying an issue directly by its identifier (e.g., 'TEAM-123')? Provide the exact GraphQL query syntax if yes, or explain how to fetch by identifier if not. Include any relevant documentation links. with maxTokens: 21000
Yes, the Linear GraphQL API does support querying an issue directly by its identifier, such as 'TEAM-123', provided you use the correct identifier format.

You can fetch an **issue by its ID** using the following GraphQL query syntax:

```graphql
query GetIssue {
  issue(id: "TEAM-123") {
    id
    title
    description
    // ...other fields you need
  }
}
```
Replace "TEAM-123" with your actual issue identifier[1].

The identifier in this context refers to the issue’s globally unique ID, which often appears as either the canonical key (like 'BLA-123') or a UUID. To find the valid IDs, you can use the Linear app (Cmd/Ctrl+K → "Copy model UUID"), or browse issues by team and look for their IDs[1].

For more details, you can refer to the official Linear API documentation at https://linear.app/developers/graphql[1][5].