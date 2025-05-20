import { NetworkError } from '../../errors.js';
import { Config } from '../../types.js';
import { createProvider } from '../../providers/base.js';
import { once } from '../../utils/once.js';
import { GitHubMCPSearch, GitHubRepository } from './github-search.js';

export interface MCPServer {
  // Marketplace metadata
  mcpId: string;
  githubUrl: string;
  name: string;
  author: string;
  description: string;
  codiconIcon: string;
  logoUrl: string;
  category: string;
  tags: string[];
  requiresApiKey: boolean;
  isRecommended: boolean;
  githubStars: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  readme?: string; // Optional README content

  // Server execution details
  command: 'uvx' | 'npx';
  args: string[];
}

export interface MarketplaceData {
  servers: MCPServer[];
}

const fetchFromMCPDirectory = once(async (): Promise<MarketplaceData> => {
  console.log('Fetching MCP servers from marketplace...');

  try {
    const response = await fetch('https://api.cline.bot/v1/mcp/marketplace');
    if (!response.ok) {
      throw new NetworkError(`Failed to fetch marketplace data: ${response.statusText}`);
    }

    const data = await response.json();
    return { servers: data };
  } catch (error) {
    console.error('Error fetching from MCP directory:', error);
    throw error;
  }
});

// Hardcoded overrides for specific MCP servers
const MCP_OVERRIDES: Record<string, Partial<MCPServer>> = {};

export class MarketplaceManager {
  private githubSearch: GitHubMCPSearch;

  constructor(private config: Config) {
    this.githubSearch = new GitHubMCPSearch(config);
  }

  private getOverrides(): Record<string, Partial<MCPServer>> {
    // Start with hardcoded overrides
    const overrides = { ...MCP_OVERRIDES };

    // Merge with config overrides if they exist
    if (this.config.mcp?.overrides) {
      for (const [mcpId, override] of Object.entries(this.config.mcp.overrides)) {
        if (mcpId in overrides) {
          console.log(`Warning: Config override for ${mcpId} is overriding a hardcoded override`);
        }
        overrides[mcpId] = override;
      }
    }

    return overrides;
  }

  async getMarketplaceData(): Promise<MarketplaceData> {
    const data = await fetchFromMCPDirectory();

    // Apply overrides
    const overrides = this.getOverrides();
    const servers = data.servers.map((server) => {
      const override = overrides[server.mcpId];
      if (override) {
        console.log(`Applying override for MCP server: ${server.mcpId}`);
        return {
          ...server,
          ...override,
        };
      }

      return server;
    });

    return { servers: await Promise.all(servers) };
  }

  async findServersForIntent(query: string, options: { debug: boolean }): Promise<MCPServer[]> {
    const matches = await this.searchServers(query, options);
    return matches;
  }

  private async fetchReadmeContent(githubUrl: string): Promise<string | null> {
    try {
      // example github url https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab

      const [root, treePath] = githubUrl.split('/tree/', 2);

      let paths = [];
      if (treePath) {
        paths.push(treePath);
      } else {
        paths.push('main', 'master', 'develop');
      }

      // Try common README file patterns
      const readmePatterns = ['README.md', 'README', 'Readme.md', 'readme.md'];

      for (const path of paths) {
        for (const pattern of readmePatterns) {
          const readmeUrl = `${root.replace('github.com', 'raw.githubusercontent.com')}/${path}/${pattern}`;
          console.log('Attempting to fetch README from', readmeUrl);

          const response = await fetch(readmeUrl);
          if (response.ok) {
            return await response.text();
          }
        }
      }

      console.log(`No README found for ${githubUrl}`);
      return null;
    } catch (error) {
      console.error(`Error fetching README for ${githubUrl}:`, error);
      return null;
    }
  }

  /**
   * Convert GitHub repositories to MCP server format, including fetching READMEs
   * @param repos GitHub repositories
   * @returns Array of MCP servers converted from GitHub repositories
   */
  private async convertGitHubReposToMcpServers(repos: GitHubRepository[]): Promise<MCPServer[]> {
    console.log(
      `Converting ${repos.length} GitHub repositories to MCP server format and fetching READMEs...`
    );

    // Process all repositories in parallel
    return Promise.all(
      repos.map(async (repo) => {
        // Try to fetch README content
        const readme = await this.fetchReadmeContent(repo.html_url);
        if (!readme) {
          console.log(`No README found for ${repo.html_url}`);
        } else {
          console.log(`Successfully fetched README for ${repo.name}`);
        }

        return {
          mcpId: `github-${repo.full_name.replace('/', '-')}`,
          githubUrl: repo.html_url,
          name: repo.name,
          author: repo.full_name.split('/')[0],
          description: repo.description || `GitHub repository: ${repo.full_name}`,
          codiconIcon: 'github',
          logoUrl: '',
          category: 'GitHub Repository',
          tags: repo.topics || [],
          requiresApiKey: false,
          isRecommended: false,
          githubStars: repo.stargazers_count,
          downloadCount: 0,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          readme: readme || undefined, // Only include readme if it was found
          command: 'npx',
          args: [],
        };
      })
    );
  }

  async searchServers(query: string, options: { debug: boolean }): Promise<MCPServer[]> {
    try {
      // 1. First, get MCP servers from the marketplace
      const marketplaceData = await this.getMarketplaceData();

      // 2. Search GitHub repositories with the user's query using the new modular GitHubMCPSearch
      console.log(`Searching GitHub repositories for query: "${query}"`);
      const githubRepos = await this.githubSearch.findGitHubRepositories(query);

      // 3. Convert GitHub repos to MCP server format
      let githubMcpServers: MCPServer[] = [];
      if (githubRepos.length > 0) {
        // Convert GitHub repos and fetch READMEs in parallel
        githubMcpServers = await this.convertGitHubReposToMcpServers(githubRepos);
      }

      // 4. Combine marketplace and GitHub servers for semantic search
      const allServers = [...marketplaceData.servers, ...githubMcpServers];

      // 5. Use Gemini to find semantic matches across all servers
      const provider = createProvider('gemini');

      const prompt = `You are a semantic search expert. Given a list of MCP servers and a search query, return ONLY the mcpIds of servers that are very likely to be able to satisfy the users request or query.
Do not include any explanation or other text, just return a JSON array of mcpId strings. If there are no suitable servers, return an empty json array.

Search Query: "${query}"

Available Servers:
${JSON.stringify(allServers, null, 2)}`;

      const response = await provider.executePrompt(prompt, {
        model: this.config.marketplace?.model || 'gemini-2.0-flash',
        maxTokens: 1000,
        systemPrompt:
          'You are a semantic search expert that helps find the most relevant MCP servers based on user queries. You only return mcpIds as a comma separated list, no other text.',
        debug: options.debug,
      });

      // 6. Parse the response to get matching IDs
      const matchingIds = new Set(
        response
          .replace(/[[\](){}"'`]/g, '') // Remove all brackets, braces, quotes
          .replace(/\s+/g, ' ') // Normalize whitespace
          .split(',')
          .map((id) => id.trim().toLowerCase())
          .filter((id) => id.length > 0)
      ); // Remove empty entries

      // 7. Filter all servers (both marketplace and GitHub) by matching IDs
      const matchingServers = allServers.filter(
        (server) =>
          matchingIds.has(server.mcpId.toLowerCase()) ||
          matchingIds.has(server.githubUrl.toLowerCase())
      );

      return matchingServers;
    } catch (error) {
      console.error('Error in searchServers:', error);

      // If Gemini fails, just return the GitHub results as a fallback
      try {
        const githubRepos = await this.githubSearch.findGitHubRepositories(query);
        if (githubRepos.length > 0) {
          return await this.convertGitHubReposToMcpServers(githubRepos);
        }
      } catch (githubError) {
        console.error('Error fetching GitHub repositories:', githubError);
      }

      throw error;
    }
  }
}
