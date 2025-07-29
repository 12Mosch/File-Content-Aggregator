/**
 * Worker Pool
 *
 * Manages a pool of web workers for parallel processing.
 * Distributes tasks among workers and handles communication.
 */

import { v4 as uuidv4 } from "uuid";

interface WorkerMessageData {
  id?: string;
  status?: string;
  error?: string;
  [key: string]: unknown;
}

interface WorkerTask {
  id: string;
  action: string;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  startTime: number;
}

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  currentTask: WorkerTask | null;
}

export class WorkerPool {
  private workers: WorkerInfo[] = [];
  private taskQueue: WorkerTask[] = [];
  private workerScript: string;
  private maxWorkers: number;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Creates a new worker pool
   * @param workerScript Path to the worker script
   * @param initialWorkers Initial number of workers to create
   * @param maxWorkers Maximum number of workers allowed
   */
  constructor(workerScript: string, initialWorkers = 2, maxWorkers = 4) {
    this.workerScript = workerScript;
    this.maxWorkers = Math.max(
      1,
      Math.min(maxWorkers, navigator.hardwareConcurrency || 4)
    );

    // Create initial workers
    this.initPromise = this.initialize(initialWorkers);
  }

  /**
   * Initialize the worker pool
   * @param count Number of workers to create
   */
  private async initialize(count: number): Promise<void> {
    const workerCount = Math.min(count, this.maxWorkers);

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < workerCount; i++) {
      initPromises.push(this.createWorker());
    }

    await Promise.all(initPromises);
    this.isInitialized = true;
  }

  /**
   * Create a new worker and set up message handling
   */
  private createWorker(): Promise<void> {
    return new Promise((resolve) => {
      const worker = new Worker(this.workerScript, { type: "module" });

      const workerInfo: WorkerInfo = {
        worker,
        busy: false,
        currentTask: null,
      };

      // Handle messages from the worker
      worker.onmessage = (event) => {
        const data = event.data as WorkerMessageData;
        const { id, status } = data;

        // Handle worker ready message
        if (status === "ready" && !id) {
          this.workers.push(workerInfo);
          resolve();
          return;
        }

        // Handle task completion
        if (workerInfo.currentTask && id === workerInfo.currentTask.id) {
          const task = workerInfo.currentTask;

          // Mark worker as available
          workerInfo.busy = false;
          workerInfo.currentTask = null;

          // Process the result
          if (status === "error") {
            task.reject(new Error(data.error || "Unknown error"));
          } else if (status === "cancelled") {
            task.reject(new Error("Task was cancelled"));
          } else {
            task.resolve(data);
          }

          // Process next task if available
          this.processQueue();
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        console.error("Worker error:", error);

        // If there's a current task, reject it
        if (workerInfo.currentTask) {
          workerInfo.currentTask.reject(
            new Error(`Worker error: ${error.message || "Unknown error"}`)
          );
          workerInfo.busy = false;
          workerInfo.currentTask = null;
        }

        // Remove this worker from the pool
        const index = this.workers.indexOf(workerInfo);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }

        // Create a replacement worker
        this.createWorker().catch(console.error);

        // Process next task if available
        this.processQueue();
      };
    });
  }

  /**
   * Process the next task in the queue if workers are available
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    // Find an available worker
    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) {
      // If all workers are busy and we haven't reached max, create a new one
      if (this.workers.length < this.maxWorkers) {
        this.createWorker()
          .then(() => this.processQueue())
          .catch(console.error);
      }
      return;
    }

    // Get the next task
    const task = this.taskQueue.shift();
    if (!task) return;

    // Assign the task to the worker
    availableWorker.busy = true;
    availableWorker.currentTask = task;

    // Send the task to the worker
    availableWorker.worker.postMessage({
      id: task.id,
      action: task.action,
      payload: task.payload,
    } as WorkerMessageData);
  }

  /**
   * Execute a task on an available worker
   * @param action The action to perform
   * @param payload The payload for the action
   * @returns A promise that resolves with the result
   */
  public async execute<T>(action: string, payload: unknown): Promise<T> {
    // Wait for initialization if needed
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }

    return new Promise<T>((resolve, reject) => {
      // Create a type-safe wrapper for the resolve function
      const typedResolve = (value: unknown): void => {
        resolve(value as T);
      };

      const task: WorkerTask = {
        id: uuidv4(),
        action,
        payload,
        resolve: typedResolve,
        reject,
        startTime: performance.now(),
      };

      // Add task to queue
      this.taskQueue.push(task);

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Execute a task on an available worker and return both the result and task ID
   * @param action The action to perform
   * @param payload The payload for the action
   * @returns A promise that resolves with an object containing the result and task ID
   */
  public async executeWithTaskId<T>(
    action: string,
    payload: unknown
  ): Promise<{ result: T; taskId: string }> {
    // Wait for initialization if needed
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }

    return new Promise<{ result: T; taskId: string }>((resolve, reject) => {
      // Create a type-safe wrapper for the resolve function
      const typedResolve = (value: unknown): void => {
        resolve({ result: value as T, taskId: task.id });
      };

      const task: WorkerTask = {
        id: uuidv4(),
        action,
        payload,
        resolve: typedResolve,
        reject,
        startTime: performance.now(),
      };

      // Add task to queue
      this.taskQueue.push(task);

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Execute a task on an available worker and return the task ID immediately with a promise for the result
   * @param action The action to perform
   * @param payload The payload for the action
   * @returns An object containing the task ID and a promise that resolves with the result
   */
  public async executeWithImmediateTaskId<T>(
    action: string,
    payload: unknown
  ): Promise<{ taskId: string; resultPromise: Promise<T> }> {
    // Wait for initialization if needed
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }

    const taskId = uuidv4();

    const resultPromise = new Promise<T>((resolve, reject) => {
      // Create a type-safe wrapper for the resolve function
      const typedResolve = (value: unknown): void => {
        resolve(value as T);
      };

      const task: WorkerTask = {
        id: taskId,
        action,
        payload,
        resolve: typedResolve,
        reject,
        startTime: performance.now(),
      };

      // Add task to queue
      this.taskQueue.push(task);

      // Process queue
      this.processQueue();
    });

    return { taskId, resultPromise };
  }

  /**
   * Cancel a specific task
   * @param taskId The ID of the task to cancel
   */
  public cancelTask(taskId: string): void {
    // Check if the task is in the queue
    const queueIndex = this.taskQueue.findIndex((task) => task.id === taskId);
    if (queueIndex !== -1) {
      // Remove from queue and reject
      const task = this.taskQueue.splice(queueIndex, 1)[0];
      task.reject(new Error("Task was cancelled"));
      return;
    }

    // Check if the task is currently being processed
    const workerInfo = this.workers.find((w) => w.currentTask?.id === taskId);
    if (workerInfo) {
      // Send cancellation message to worker
      workerInfo.worker.postMessage({
        id: uuidv4(),
        action: "cancel",
        payload: {
          requestId: taskId,
        },
      } as WorkerMessageData);
    }
  }

  /**
   * Terminate all workers and clear the queue
   */
  public terminate(): void {
    // Reject all queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error("Worker pool terminated"));
    }
    this.taskQueue = [];

    // Terminate all workers
    for (const workerInfo of this.workers) {
      if (workerInfo.currentTask) {
        workerInfo.currentTask.reject(new Error("Worker pool terminated"));
      }
      workerInfo.worker.terminate();
    }
    this.workers = [];

    this.isInitialized = false;
  }

  /**
   * Get statistics about the worker pool
   */
  public getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queuedTasks: this.taskQueue.length,
      maxWorkers: this.maxWorkers,
    };
  }
}
