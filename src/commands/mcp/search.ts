import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { MarketplaceManager } from './marketplace.js';

export class SearchCommand implements Command {
  constructor(private marketplaceManager: MarketplaceManager) {}

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    if (!query?.trim()) {
      throw new Error('Search query cannot be empty');
    }

    yield `Searching for MCP servers and GitHub repositories matching: "${query}"\n`;
    yield `Processing query for intelligent search...\n`;

    const servers = await this.marketplaceManager.searchServers(query, options);
    if (servers.length === 0) {
      yield 'No results found matching your query.\n';
      return;
    }

    if (options?.json) {
      yield JSON.stringify(servers, null, 2) + '\n';
      return;
    }

    // Separate marketplace and GitHub results for display purposes
    const marketplaceServers = servers.filter((server) => !server.mcpId.startsWith('github-'));
    const githubRepos = servers.filter((server) => server.mcpId.startsWith('github-'));

    yield `\nFound ${servers.length} total results matching your query:\n`;

    // Display marketplace servers
    if (marketplaceServers.length > 0) {
      yield `\n${marketplaceServers.length} matching MCP marketplace servers:\n`;
      yield `${'='.repeat(40)}\n`;

      for (const server of marketplaceServers) {
        yield `\n${server.name}\n`;
        yield `Description: ${server.description}\n`;
        yield `Category: ${server.category}\n`;
        yield `Tags: ${server.tags.join(', ')}\n`;
        yield `GitHub: ${server.githubUrl}\n`;
        yield `${'─'.repeat(30)}\n`;
      }
    }

    // Display GitHub repositories
    if (githubRepos.length > 0) {
      yield `\n${githubRepos.length} matching GitHub repositories with MCP capabilities:\n`;
      yield `${'='.repeat(40)}\n`;

      for (const repo of githubRepos) {
        yield `\n${repo.name}\n`;
        yield `Description: ${repo.description}\n`;
        yield `Author: ${repo.author}\n`;
        yield `Stars: ${repo.githubStars}\n`;
        yield `GitHub: ${repo.githubUrl}\n`;
        yield `${'─'.repeat(30)}\n`;
      }
    }
  }
}
