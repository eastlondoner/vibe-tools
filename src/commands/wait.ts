import type { Command, CommandGenerator, CommandOptions } from '../types';

export class WaitCommand implements Command {
  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const seconds = parseInt(query, 10);
    if (isNaN(seconds) || seconds <= 0) {
      yield 'Error: Please provide a positive number of seconds to wait.';
      return;
    }

    yield `Waiting for ${seconds} second(s)...`;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    yield `Finished waiting for ${seconds} second(s).`;
  }
}
