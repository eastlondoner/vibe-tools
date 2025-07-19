import type { Command, CommandGenerator, CommandMap, CommandOptions } from '../types';
import { ConnectCommand } from './linear/connect';
import { IssueCommand } from './linear/issue';

export class LinearCommand implements Command {
  private subcommands: CommandMap = {
    connect: new ConnectCommand(),
    'get-issue': new IssueCommand(),      // exact name requested
    issue: new IssueCommand(),            // alias for consistency with other integrations
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