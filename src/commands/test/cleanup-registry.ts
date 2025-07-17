interface CleanupTask {
  id: string;
  cleanup: () => Promise<void>;
  priority: number; // Higher priority runs first
}

class CleanupRegistry {
  private tasks: Map<string, CleanupTask> = new Map();
  private isCleaningUp = false;

  register(id: string, cleanup: () => Promise<void>, priority: number = 0): void {
    this.tasks.set(id, { id, cleanup, priority });
  }

  unregister(id: string): void {
    this.tasks.delete(id);
  }

  async cleanupTask(cleanupId: string): Promise<void> {
    const task = this.tasks.get(cleanupId);
    if (!task) {
      console.error(`Cleanup task ${cleanupId} not found`);
      return;
    }
    await task.cleanup();
    this.unregister(cleanupId);
  }

  async executeCleanup(): Promise<void> {
    if (this.isCleaningUp) return;

    this.isCleaningUp = true;
    const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => b.priority - a.priority);

    for (const task of sortedTasks) {
      try {
        await task.cleanup();
        this.tasks.delete(task.id);
      } catch (error) {
        console.error(`Cleanup task ${task.id} failed:`, error);
      }
    }

    this.isCleaningUp = false;
  }

  clear(): void {
    this.tasks.clear();
  }
}

export const globalCleanupRegistry = new CleanupRegistry();

// Monitor active resources that might prevent exit
export function monitorActiveResources(): void {
  const handles = (process as any)._getActiveHandles?.();
  const requests = (process as any)._getActiveRequests?.();

  if (handles?.length > 0) {
    console.log('Active handles preventing exit:', handles.length);
    handles.forEach((handle: any, index: number) => {
      console.log(`  Handle ${index}:`, handle.constructor.name);
    });
  }

  if (requests?.length > 0) {
    console.log('Active requests preventing exit:', requests.length);
  }
}

// Note: Process exit handlers should be registered by the consuming command, not globally
// This allows the command to control when and how cleanup and exit happens
