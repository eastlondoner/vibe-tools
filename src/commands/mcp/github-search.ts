import { createProvider } from '../../providers/base.js';
import { getGitHubHeaders } from '../github/githubAuth.js';
import { Config } from '../../types.js';

/**
 * Interface for GitHub repository search results
 */
export interface GitHubRepository {
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  created_at: string;
  updated_at: string;
  topics: string[];
}

/**
 * Class for handling GitHub repository search operations specifically for MCP
 */
export class GitHubMCPSearch {
  constructor(private config: Config) {}

  /**
   * Extract keywords from a natural language query for GitHub search
   * @param query Original user query
   * @returns Array of extracted keywords for GitHub search
   */
  async extractSearchKeywords(query: string): Promise<string[]> {
    // Direct pattern matching for obvious technology mentions
    // Case 1: "X mcp" or "mcp X" format
    if (/^mcp[\s-][\w-]+$/i.test(query) || /^[\w-]+[\s-]mcp$/i.test(query)) {
      console.log(
        `Query "${query}" appears to be a direct MCP technology mention, using as is for GitHub search`
      );
      // Clean it to ensure "X mcp" format
      const parts = query
        .toLowerCase()
        .split(/[\s-]+/)
        .filter((p) => p !== '');
      if (parts.length === 2) {
        if (parts[0] === 'mcp') {
          return [`${parts[1]} mcp`];
        } else if (parts[1] === 'mcp') {
          return [`${parts[0]} mcp`];
        }
      }
      return [query.toLowerCase()];
    }

    // Case 2: Various forms of "find mcp for X" or "need X mcp server"
    const techPatterns = [
      /(?:find|get|search|looking\s+for|need|want|using|use)\s+(?:a|an)?\s*(?:mcp|model\s+context\s+protocol)(?:\s+server)?\s+for\s+(\w+)/i,
      /(?:find|get|search|looking\s+for|need|want|using|use)\s+(?:a|an)?\s*(\w+)(?:\s+mcp|model\s+context\s+protocol)(?:\s+server)?/i,
      /mcp\s+(?:server\s+)?for\s+(\w+)/i,
      /(\w+)\s+mcp\s+server/i,
    ];

    for (const pattern of techPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const tech = match[1].toLowerCase();
        // Skip common filler words
        if (['the', 'and', 'for', 'with', 'that', 'can', 'this', 'some', 'any'].includes(tech)) {
          continue;
        }
        console.log(`Detected direct technology request for "${tech}"`);
        return [`${tech} mcp`];
      }
    }

    // For natural language queries, use Gemini to extract keywords
    console.log(`Extracting keywords from natural language query: "${query}"`);

    try {
      const provider = createProvider('gemini');

      const prompt = `Extract ONLY the specific technologies or capabilities mentioned in this query about MCP servers. Do not add any keywords that aren't directly mentioned in the query.

Original query: "${query}"

Guidelines:
1. If the query includes a specific technology (like "firebase", "supabase", "git", etc.), use that EXACT term + "mcp" as the keyword
2. If someone asks "find me an mcp server for X", extract ONLY "X mcp" as the keyword
3. Return a MAXIMUM of 2 keywords
4. DO NOT guess or add generic terms like "web search mcp" or "database mcp" unless they're explicitly mentioned
5. If there are no clear technology names in the query, return ONLY ["mcp"] - do not invent keywords
6. Example: "find me an mcp server for firebase" → ["firebase mcp"]
7. Example: "I need a tool for git and database" → ["git mcp", "database mcp"]

Return ONLY a JSON array of strings with the extracted keywords. 
IMPORTANT: Do not include any markdown formatting, code block markers, or other text. Return only the JSON array.`;

      const response = await provider.executePrompt(prompt, {
        model: this.config.marketplace?.model || 'gemini-2.0-flash',
        maxTokens: 200,
        systemPrompt:
          'Extract ONLY explicitly mentioned technologies as keywords. No guessing. Max 2 keywords. Return only a JSON array of strings.',
        debug: false,
      });

      // Clean the response of any markdown or code formatting
      const cleanedResponse = response
        .replace(/```(?:json|javascript)?\s*/g, '') // Remove code block markers
        .replace(/```\s*$/g, '') // Remove trailing code block markers
        .replace(/^\s*\[\s*|\s*\]\s*$/g, '') // If we still have outer brackets, clean them for comma splitting
        .trim();

      console.log(`Cleaned response: ${cleanedResponse}`);

      // Parse JSON response to get keywords
      try {
        // First try to parse directly as JSON
        let keywords: string[] = [];

        // Try parsing as a full JSON array
        try {
          // Make sure we have brackets for valid JSON
          const jsonToTry = cleanedResponse.startsWith('[')
            ? cleanedResponse
            : `[${cleanedResponse}]`;
          keywords = JSON.parse(jsonToTry);
        } catch (innerError) {
          // If that fails, try comma splitting
          keywords = cleanedResponse
            .split(',')
            .map((k) => {
              // Clean up quotation marks and extra spaces
              return k.replace(/^["']\s*|\s*["']$/g, '').trim();
            })
            .filter((k) => k.length > 0);
        }

        if (keywords.length > 0) {
          console.log(`Extracted ${keywords.length} keywords: ${keywords.join(', ')}`);

          // Ensure keywords are in the preferred format
          const formattedKeywords = keywords.map((k) => {
            if (!k) return 'mcp'; // Handle empty strings

            const keyword = k.toLowerCase().trim();
            if (keyword === 'mcp' || keyword === 'mcp server') {
              return 'mcp'; // Don't add "tool" - just return "mcp"
            }
            if (!keyword.includes('mcp')) {
              return `${keyword} mcp`;
            }
            return keyword;
          });

          console.log(`Formatted keywords: ${formattedKeywords.join(', ')}`);
          return formattedKeywords.slice(0, 2); // Limit to 2 keywords
        }
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        // Let it continue to the fallback below
      }

      // Fallback: use basic keyword extraction if all parsing failed
      console.log('Failed to extract keywords from response, using basic keyword extraction');
      return this.extractKeywordsBasic(query);
    } catch (error) {
      console.error('Error using Gemini for keyword extraction:', error);
      // Fallback to basic keyword extraction
      return this.extractKeywordsBasic(query);
    }
  }

  /**
   * Basic keyword extraction from query as fallback
   * @param query Original user query
   * @returns Array of extracted keywords
   */
  private extractKeywordsBasic(query: string): string[] {
    // Normalize query and split into words
    const words = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2) // Filter out short words
      .filter(
        (word) =>
          ![
            'the',
            'and',
            'for',
            'with',
            'that',
            'can',
            'this',
            'has',
            'have',
            'server',
            'find',
            'need',
            'want',
            'using',
            'use',
            'tool',
            'mcp',
          ].includes(word)
      ); // Remove common stopwords and "mcp" itself

    // Create candidate keywords
    const keywords: string[] = [];

    // Add explicitly mentioned technologies first
    for (const word of words) {
      if (!keywords.includes(`${word} mcp`)) {
        // Check if this is a likely technology name (not a common verb or article)
        keywords.push(`${word} mcp`);
        if (keywords.length >= 2) break; // Limit to 2 keywords
      }
    }

    // If we couldn't find any keywords, use just "mcp"
    if (keywords.length === 0) {
      keywords.push('mcp');
    }

    console.log(`Basic keyword extraction produced: ${keywords.join(', ')}`);
    return keywords.slice(0, 2); // Ensure limit to 2 keywords
  }

  /**
   * Search GitHub repositories for a specific keyword
   * @param keyword Search keyword
   * @param maxResults Maximum number of results to return
   * @returns Array of GitHub repositories
   */
  async searchGitHubReposForKeyword(
    keyword: string,
    maxResults: number = 5
  ): Promise<GitHubRepository[]> {
    try {
      // Make sure keyword is clean of any markdown or formatting
      keyword = keyword.replace(/```.*?\n|```/g, '').trim();

      console.log(`Searching GitHub repositories for keyword: "${keyword}"`);

      // Simple direct search with the keyword - don't modify the search query
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&order=desc&per_page=${maxResults}`;

      console.log(`Making GitHub API request to: ${url}`);
      const response = await fetch(url, {
        headers: getGitHubHeaders(),
      });

      if (!response.ok) {
        console.error(`GitHub API Error: ${response.status} - ${response.statusText}`);
        return [];
      }

      const data = await response.json();

      // Log the number of results
      const items = data.items || [];
      console.log(`Found ${items.length} GitHub repositories matching keyword "${keyword}"`);

      if (items.length > 0) {
        items.forEach((repo: GitHubRepository) => {
          console.log(
            `- ${repo.full_name}: ${repo.description || 'No description'} (${repo.stargazers_count} stars)`
          );
        });
      }

      return items;
    } catch (error) {
      console.error(`Error searching GitHub repositories for keyword "${keyword}":`, error);
      return [];
    }
  }

  /**
   * Process user query to find relevant GitHub repositories with "mcp" in the name
   * @param query User's original query
   * @param maxResultsPerKeyword Maximum number of results per keyword
   * @returns Array of unique GitHub repositories matching the query
   */
  async findGitHubRepositories(
    query: string,
    maxResultsPerKeyword: number = 5
  ): Promise<GitHubRepository[]> {
    try {
      // 1. Extract keywords from the query
      const keywords = await this.extractSearchKeywords(query);

      if (keywords.length === 0) {
        console.log('No valid keywords extracted, using "mcp" as default');
        keywords.push('mcp');
      }

      console.log(`Using keywords for GitHub search: ${keywords.join(', ')}`);

      // 2. Search GitHub for each keyword
      const allRepos: GitHubRepository[] = [];

      for (const keyword of keywords) {
        // Ensure any keyword used for search is clean
        const cleanKeyword = keyword.replace(/```.*?\n|```/g, '').trim();
        const repos = await this.searchGitHubReposForKeyword(cleanKeyword, maxResultsPerKeyword);
        allRepos.push(...repos);
      }

      // 3. Filter out duplicates based on full_name
      const uniqueRepos = this.filterDuplicateRepositories(allRepos);

      console.log(`Found ${uniqueRepos.length} unique GitHub repositories across all keywords`);
      return uniqueRepos;
    } catch (error) {
      console.error('Error in findGitHubRepositories:', error);
      return [];
    }
  }

  /**
   * Filter out duplicate repositories based on full_name
   * @param repos Array of GitHub repositories
   * @returns Array of unique GitHub repositories
   */
  private filterDuplicateRepositories(repos: GitHubRepository[]): GitHubRepository[] {
    const seen = new Set<string>();
    const uniqueRepos: GitHubRepository[] = [];

    for (const repo of repos) {
      if (!seen.has(repo.full_name)) {
        seen.add(repo.full_name);
        uniqueRepos.push(repo);
      }
    }

    return uniqueRepos;
  }
}
