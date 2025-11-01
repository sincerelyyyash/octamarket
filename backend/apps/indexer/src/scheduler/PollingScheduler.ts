import { logger } from '../utils/logger.js';

export type ScheduledTask = () => Promise<void>;

export interface ScheduleConfig {
  name: string;
  intervalMs: number;
  task: ScheduledTask;
  runImmediately?: boolean;
}

/**
 * Manages scheduled polling tasks
 */
export class PollingScheduler {
  private schedules: Map<string, NodeJS.Timeout> = new Map();
  private running: Map<string, boolean> = new Map();

  /**
   * Schedule a task to run at regular intervals
   */
  schedule(config: ScheduleConfig): void {
    const { name, intervalMs, task, runImmediately = false } = config;

    if (this.schedules.has(name)) {
      logger.warn(`Task ${name} is already scheduled, skipping`);
      return;
    }

    logger.info(`Scheduling task: ${name}`, { intervalMs });

    const wrappedTask = async () => {
      // Prevent concurrent execution
      if (this.running.get(name)) {
        logger.debug(`Task ${name} is still running, skipping this interval`);
        return;
      }

      this.running.set(name, true);
      const startTime = Date.now();

      try {
        await task();
        const duration = Date.now() - startTime;
        logger.debug(`Task ${name} completed`, { duration });
      } catch (error) {
        logger.error(`Error in scheduled task ${name}`, { error });
      } finally {
        this.running.set(name, false);
      }
    };

    // Run immediately if requested
    if (runImmediately) {
      wrappedTask();
    }

    // Schedule recurring execution
    const timer = setInterval(wrappedTask, intervalMs);
    this.schedules.set(name, timer);
  }

  /**
   * Unschedule a task
   */
  unschedule(name: string): void {
    const timer = this.schedules.get(name);
    if (timer) {
      clearInterval(timer);
      this.schedules.delete(name);
      this.running.delete(name);
      logger.info(`Unscheduled task: ${name}`);
    }
  }

  /**
   * Unschedule all tasks
   */
  unscheduleAll(): void {
    for (const [name, timer] of this.schedules.entries()) {
      clearInterval(timer);
      logger.info(`Unscheduled task: ${name}`);
    }
    this.schedules.clear();
    this.running.clear();
  }

  /**
   * Check if a task is currently running
   */
  isRunning(name: string): boolean {
    return this.running.get(name) || false;
  }

  /**
   * Get all scheduled task names
   */
  getScheduledTasks(): string[] {
    return Array.from(this.schedules.keys());
  }
}

