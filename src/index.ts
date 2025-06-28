/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Logger interface for profiling output
 */
export interface Logger {
  debug?: (message: string | object, ...args: unknown[]) => void;
  log?: (message: string | object, ...args: unknown[]) => void;
  warn?: (message: string | object, ...args: unknown[]) => void;
  error?: (message: string | object, ...args: unknown[]) => void;
  verbose?: (message: string | object, ...args: unknown[]) => void;
  [key: string]: ((message: string | object, ...args: unknown[]) => void) | undefined;
}

/**
 * Performance profiling utility options
 */
export interface ProfileConfig {
  /** Enable memory profiling */
  trackMemory?: boolean;
  /** Enable garbage collection monitoring */
  enableGC?: boolean;
  /** Memory threshold in MB to trigger GC */
  gcThresholdMB?: number;
  /** Logger instance to use (defaults to console) */
  logger?: Logger | Console;
  /** Custom tags to include in logs */
  tags?: Record<string, unknown>;
  /** Log level for profiling output */
  logLevel?: 'debug' | 'log' | 'verbose';
  /** Whether to log individual checkpoints (default: true) */
  logSteps?: boolean;
  /** Enable verbose logging with detailed intermediate steps (default: false) */
  verbose?: boolean;
  /** Whether to log any output at all (default: true) */
  silent?: boolean;
}

/**
 * Performance profiling result
 */
export interface ProfileResult {
  /** Function name or identifier */
  name: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Memory usage before execution */
  memBefore?: NodeJS.MemoryUsage;
  /** Memory usage after execution */
  memAfter?: NodeJS.MemoryUsage;
  /** Memory delta (difference) */
  memDelta?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  /** Whether GC was triggered */
  gcTriggered?: boolean;
  /** Custom tags */
  tags?: Record<string, unknown>;
  /** Result of the profiled function */
  result?: unknown;
  /** Error if function threw */
  error?: unknown;
}

/**
 * Format memory usage in MB
 */
const formatMemMB = (bytes: number): string => {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
};

/**
 * Calculate memory delta between two memory usage objects
 */
const calcMemDelta = (before: NodeJS.MemoryUsage, after: NodeJS.MemoryUsage) => ({
  heapUsed: after.heapUsed - before.heapUsed,
  heapTotal: after.heapTotal - before.heapTotal,
  external: after.external - before.external,
  rss: after.rss - before.rss,
});

/**
 * Check if GC should be triggered based on memory threshold
 */
const shouldTriggerGC = (memUsage: NodeJS.MemoryUsage, thresholdMB: number): boolean => {
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  return heapUsedMB > thresholdMB;
};

/**
 * Profile a function execution with timing and memory monitoring
 *
 * @example
 * ```typescript
 * // As a wrapper function
 * const result = await profile(
 *   () => someAsyncOperation(),
 *   'MyOperation',
 *   { trackMemory: true, enableGC: true }
 * );
 *
 * // Using with CarService method
 * const { result: cars } = await profile(
 *   () => this.carRepository.find({ where: { marketplaceVisible: true } }),
 *   'fetchMarketplaceCars',
 *   {
 *     trackMemory: true,
 *     enableGC: true,
 *     gcThresholdMB: 100,
 *     logger: this.logger,
 *     tags: { operation: 'database-query' }
 *   }
 * );
 * ```
 */
export async function profile<T>(
  fn: () => T | Promise<T>,
  name: string,
  config: ProfileConfig = {},
): Promise<{ result: T; profile: ProfileResult }> {
  const {
    trackMemory = true,
    enableGC = false,
    gcThresholdMB = 100,
    logger = console,
    tags = {},
    logLevel = 'debug',
    silent = false,
    verbose = false,
  } = config;

  const startTime = performance.now();
  let memBefore: NodeJS.MemoryUsage | undefined;
  let memAfter: NodeJS.MemoryUsage | undefined;
  let gcTriggered = false;
  let result: T;
  let error: unknown;

  // Capture initial memory state
  if (trackMemory) {
    memBefore = process.memoryUsage();
  }

  try {
    // Execute the function
    result = await fn();
  } catch (err) {
    error = err;
    throw err; // Re-throw the error after capturing it
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  // Capture final memory state and handle GC
  if (trackMemory) {
    memAfter = process.memoryUsage();

    if (enableGC && shouldTriggerGC(memAfter, gcThresholdMB)) {
      if (global.gc) {
        global.gc();
        gcTriggered = true;
        // Capture memory after GC
        memAfter = process.memoryUsage();
      }
    }
  }

  // Calculate memory delta
  const memDelta = memBefore && memAfter ? calcMemDelta(memBefore, memAfter) : undefined;

  // Build profile result
  const profileResult: ProfileResult = {
    name,
    duration,
    memBefore,
    memAfter,
    memDelta,
    gcTriggered,
    tags,
    result,
    error,
  };

  // Log the profiling results
  if (!silent && verbose) {
    const logData: Record<string, unknown> = {
      function: name,
      duration: `${duration.toFixed(2)}ms`,
      ...(memBefore && {
        memBefore: {
          heap: formatMemMB(memBefore.heapUsed),
          rss: formatMemMB(memBefore.rss),
        },
      }),
      ...(memAfter && {
        memAfter: {
          heap: formatMemMB(memAfter.heapUsed),
          rss: formatMemMB(memAfter.rss),
        },
      }),
      ...(memDelta && {
        memDelta: {
          heap: `${memDelta.heapUsed >= 0 ? '+' : ''}${formatMemMB(memDelta.heapUsed)}`,
          rss: `${memDelta.rss >= 0 ? '+' : ''}${formatMemMB(memDelta.rss)}`,
        },
      }),
      ...(gcTriggered && { gcTriggered: true }),
      ...tags,
    };

    if (error) {
      logData.error = error instanceof Error ? error.message : String(error);
    }

    const logMessage = `Profile: ${name} completed in ${duration.toFixed(2)}ms`;

    // Log based on the specified log level
    if (logLevel && logger && typeof (logger as Logger)[logLevel] === 'function') {
      (logger as Logger)[logLevel]!({ message: logMessage, ...logData });
    } else if (logger && typeof (logger as Console).log === 'function') {
      (logger as Console).log({ message: logMessage, ...logData });
    } else {
      console.log({ message: logMessage, ...logData });
    }
  }

  return { result, profile: profileResult };
}

/**
 * Decorator for profiling class methods
 *
 * @example
 * ```typescript
 * class CarService {
 *   @Profile('listCars', { trackMemory: true, enableGC: true })
 *   async listCar(data: AdminListCarRequestPayload.AsObject) {
 *     // method implementation
 *   }
 *
 *   @Profile('searchCars', {
 *     trackMemory: true,
 *     gcThresholdMB: 150,
 *     tags: { operation: 'search' }
 *   })
 *   async searchCar(data: MarketplaceSearchRequestPayload.AsObject) {
 *     // method implementation
 *   }
 * }
 * ```
 */
export function Profile(name?: string, config: ProfileConfig = {}) {
  return function <T extends (...args: any[]) => any>(
    target: T,
    context: { name: string | symbol },
  ): T {
    const originalMethod = target;
    const functionName = name || `${String(context.name)}`;

    return async function (this: any, ...args: any[]) {
      const { result } = await profile(
        () => originalMethod.apply(this, args),
        functionName,
        config,
      );
      return result;
    } as T;
  };
}

/**
 * Simple timing utility for quick performance checks
 *
 * @example
 * ```typescript
 * // Basic usage
 * const timer = new Timer('database-query');
 * const cars = await this.carRepository.find();
 * timer.stop({ carCount: cars.length });
 *
 * // Static method usage
 * const result = await Timer.time(
 *   () => this.processLargeBatch(data),
 *   'processLargeBatch'
 * );
 * ```
 */
export class Timer {
  private startTime: number;
  private name: string;
  private logger: Logger | Console;

  constructor(name: string, logger: Logger | Console = console) {
    this.name = name;
    this.logger = logger;
    this.startTime = performance.now();
  }

  stop(data?: Record<string, unknown>): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    if (typeof (this.logger as Logger).debug === 'function') {
      (this.logger as Logger).debug!({
        message: `Timer: ${this.name} completed in ${duration.toFixed(2)}ms`,
        duration: `${duration.toFixed(2)}ms`,
        ...data,
      });
    } else {
      (this.logger as Console).log({
        message: `Timer: ${this.name} completed in ${duration.toFixed(2)}ms`,
        duration: `${duration.toFixed(2)}ms`,
        ...data,
      });
    }

    return duration;
  }

  static async time<T>(
    fn: () => T | Promise<T>,
    name: string,
    logger: Logger | Console = console,
  ): Promise<T> {
    const timer = new Timer(name, logger);
    try {
      const result = await fn();
      timer.stop();
      return result;
    } catch (error) {
      timer.stop({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}

/**
 * Memory monitoring utility for tracking memory usage over time
 *
 * @example
 * ```typescript
 * const monitor = new MemMonitor(this.logger);
 *
 * monitor.snap('start');
 * await this.processAlerts(alerts);
 * monitor.snap('after-processing');
 *
 * // Compare memory usage
 * monitor.compare('start', 'after-processing');
 *
 * // Get all snapshots for analysis
 * const snapshots = monitor.getSnaps();
 * ```
 */
export class MemMonitor {
  private snaps: Array<{
    timestamp: number;
    usage: NodeJS.MemoryUsage;
    label?: string;
  }> = [];
  private logger: Logger | Console;

  constructor(logger: Logger | Console = console) {
    this.logger = logger;
  }

  snap(label?: string): NodeJS.MemoryUsage {
    const usage = process.memoryUsage();
    this.snaps.push({
      timestamp: Date.now(),
      usage,
      label,
    });

    if (typeof (this.logger as Logger).debug === 'function') {
      (this.logger as Logger).debug!({
        message: `Memory snapshot: ${label || 'unnamed'}`,
        heap: formatMemMB(usage.heapUsed),
        rss: formatMemMB(usage.rss),
        external: formatMemMB(usage.external),
      });
    } else {
      (this.logger as Console).log({
        message: `Memory snapshot: ${label || 'unnamed'}`,
        heap: formatMemMB(usage.heapUsed),
        rss: formatMemMB(usage.rss),
        external: formatMemMB(usage.external),
      });
    }

    return usage;
  }

  compare(fromLabel?: string, toLabel?: string): void {
    const from = fromLabel ? this.snaps.find((s) => s.label === fromLabel) : this.snaps[0];
    const to = toLabel
      ? this.snaps.find((s) => s.label === toLabel)
      : this.snaps[this.snaps.length - 1];

    if (!from || !to) {
      if (typeof (this.logger as Logger).warn === 'function') {
        (this.logger as Logger).warn!('Memory comparison failed: snapshot not found');
      } else {
        (this.logger as Console).warn('Memory comparison failed: snapshot not found');
      }
      return;
    }

    const delta = calcMemDelta(from.usage, to.usage);
    const duration = to.timestamp - from.timestamp;

    if (typeof (this.logger as Logger).debug === 'function') {
      (this.logger as Logger).debug!({
        message: `Memory comparison: ${from.label || 'start'} → ${to.label || 'end'}`,
        duration: `${duration}ms`,
        heapDelta: `${delta.heapUsed >= 0 ? '+' : ''}${formatMemMB(delta.heapUsed)}`,
        rssDelta: `${delta.rss >= 0 ? '+' : ''}${formatMemMB(delta.rss)}`,
        externalDelta: `${delta.external >= 0 ? '+' : ''}${formatMemMB(delta.external)}`,
      });
    } else {
      (this.logger as Console).log({
        message: `Memory comparison: ${from.label || 'start'} → ${to.label || 'end'}`,
        duration: `${duration}ms`,
        heapDelta: `${delta.heapUsed >= 0 ? '+' : ''}${formatMemMB(delta.heapUsed)}`,
        rssDelta: `${delta.rss >= 0 ? '+' : ''}${formatMemMB(delta.rss)}`,
        externalDelta: `${delta.external >= 0 ? '+' : ''}${formatMemMB(delta.external)}`,
      });
    }
  }

  clear(): void {
    this.snaps = [];
  }

  getSnaps(): Array<{
    timestamp: number;
    usage: NodeJS.MemoryUsage;
    label?: string;
  }> {
    return [...this.snaps];
  }
}

/**
 * Advanced profiler for continuous monitoring
 * Useful for monitoring memory-intensive operations like alert processing
 *
 * @example
 * ```typescript
 * const profiler = new Profiler('alert-processing', {
 *   enableGC: true,
 *   gcThresholdMB: 100,
 *   logger: this.logger
 * });
 *
 * profiler.start();
 *
 * for (const alert of alerts) {
 *   profiler.mark(`processing-alert-${alert.id}`);
 *   await this.processAlert(alert);
 * }
 *
 * const summary = profiler.end();
 * // Returns detailed performance summary
 * ```
 */
export class Profiler {
  private name: string;
  private config: ProfileConfig;
  private startTime: number = 0;
  private marks: Array<{
    label: string;
    timestamp: number;
    memory?: NodeJS.MemoryUsage;
    gcTriggered?: boolean;
  }> = [];
  private gcCount = 0;

  constructor(name: string, config: ProfileConfig = {}) {
    this.name = name;
    this.config = {
      trackMemory: true,
      enableGC: false,
      gcThresholdMB: 100,
      logger: console,
      logLevel: 'debug',
      logSteps: true,
      verbose: false,
      silent: false,
      ...config,
    };
  }

  start(): void {
    this.startTime = performance.now();
    this.marks = [
      {
        label: 'start',
        timestamp: this.startTime,
        memory: this.config.trackMemory ? process.memoryUsage() : undefined,
        gcTriggered: false,
      },
    ];
    this.gcCount = 0;

    // Only log start message if enabled and verbose mode
    if (!this.config.silent && this.config.verbose) {
      this.log('Profiler started');
    }
  }

  mark(label: string): void {
    const timestamp = performance.now();
    let memory: NodeJS.MemoryUsage | undefined;
    let gcTriggered = false;

    if (this.config.trackMemory) {
      memory = process.memoryUsage();

      if (
        this.config.enableGC &&
        this.config.gcThresholdMB &&
        shouldTriggerGC(memory, this.config.gcThresholdMB)
      ) {
        if (global.gc) {
          global.gc();
          gcTriggered = true;
          this.gcCount++;
          // Capture memory after GC
          memory = process.memoryUsage();
        }
      }
    }

    // Calculate duration since last checkpoint
    const lastMark = this.marks[this.marks.length - 1];
    const stepDuration = lastMark ? timestamp - lastMark.timestamp : timestamp - this.startTime;

    this.marks.push({
      label,
      timestamp,
      memory,
      gcTriggered,
    });

    // Enhanced logging with phase duration
    const logData: Record<string, unknown> = {
      mark: label,
      totalElapsed: `${(timestamp - this.startTime).toFixed(2)}ms`,
      stepDuration: `${stepDuration.toFixed(2)}ms`,
      ...(memory && {
        memory: {
          heap: formatMemMB(memory.heapUsed),
          rss: formatMemMB(memory.rss),
        },
      }),
      ...(gcTriggered && { gcTriggered: true }),
    };

    // Show memory delta from previous checkpoint
    if (lastMark?.memory && memory) {
      const delta = calcMemDelta(lastMark.memory, memory);
      logData.memDelta = {
        heap: `${delta.heapUsed >= 0 ? '+' : ''}${formatMemMB(delta.heapUsed)}`,
        rss: `${delta.rss >= 0 ? '+' : ''}${formatMemMB(delta.rss)}`,
      };
    }

    // Only log checkpoints if enabled and verbose mode
    if (!this.config.silent && this.config.logSteps && this.config.verbose) {
      this.log(`Mark: ${label}`, logData);
    }
  }

  /**
   * Get current performance summary without ending the profiler
   */
  getSummary(): {
    name: string;
    elapsed: number;
    markCount: number;
    gcCount: number;
    lastStep?: string;
    lastStepDuration?: number;
  } {
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    const lastMark = this.marks[this.marks.length - 1];
    const secondLastMark = this.marks[this.marks.length - 2];

    return {
      name: this.name,
      elapsed,
      markCount: this.marks.length,
      gcCount: this.gcCount,
      ...(lastMark &&
        secondLastMark && {
          lastStep: `${secondLastMark.label} → ${lastMark.label}`,
          lastStepDuration: lastMark.timestamp - secondLastMark.timestamp,
        }),
    };
  }

  /**
   * Get detailed phase breakdown up to current point
   */
  getSteps(): Array<{
    step: string;
    duration: number;
    durationFormatted: string;
    percentage: number;
  }> {
    if (this.marks.length < 2) return [];

    const currentTime = performance.now();
    const totalElapsed = currentTime - this.startTime;
    const steps = [];

    for (let i = 1; i < this.marks.length; i++) {
      const prev = this.marks[i - 1];
      const current = this.marks[i];
      const duration = current.timestamp - prev.timestamp;

      steps.push({
        step: `${prev.label} → ${current.label}`,
        duration,
        durationFormatted: `${duration.toFixed(2)}ms`,
        percentage: (duration / totalElapsed) * 100,
      });
    }

    return steps.sort((a, b) => b.duration - a.duration);
  }

  end(): {
    name: string;
    totalDuration: number;
    totalGCCount: number;
    marks: Array<{
      label: string;
      timestamp: number;
      timestampFormatted: string;
      stepDuration?: number;
      stepDurationFormatted?: string;
      memory?: {
        heap: string;
        rss: string;
      };
      gcTriggered?: boolean;
    }>;
    memDeltas?: Array<{
      from: string;
      to: string;
      duration: string;
      heapDelta: string;
      rssDelta: string;
    }>;
    steps?: Array<{
      step: string;
      duration: number;
      durationFormatted: string;
      startTime: number;
      endTime: number;
      gcTriggered?: boolean;
    }>;
  } {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    // Add final checkpoint for memory tracking if enabled
    if (this.config.trackMemory) {
      const lastMark = this.marks[this.marks.length - 1];
      if (lastMark?.label !== 'end') {
        this.mark('end');
      }
    }

    // Calculate memory deltas and phase durations between checkpoints
    const memDeltas = [];
    const steps = [];

    for (let i = 1; i < this.marks.length; i++) {
      const prev = this.marks[i - 1];
      const current = this.marks[i];
      const stepDuration = current.timestamp - prev.timestamp;

      // Add phase information
      steps.push({
        step: `${prev.label} → ${current.label}`,
        duration: stepDuration,
        durationFormatted: `${stepDuration.toFixed(2)}ms`,
        startTime: prev.timestamp - this.startTime,
        endTime: current.timestamp - this.startTime,
        gcTriggered: current.gcTriggered,
      });

      if (prev.memory && current.memory) {
        const delta = calcMemDelta(prev.memory, current.memory);
        memDeltas.push({
          from: prev.label,
          to: current.label,
          duration: stepDuration,
          delta,
        });
      }
    }

    const summary = {
      name: this.name,
      totalDuration,
      totalGCCount: this.gcCount,
      marks: this.marks.map((cp, index) => ({
        label: cp.label,
        timestamp: cp.timestamp - this.startTime, // Relative to start
        timestampFormatted: `${(cp.timestamp - this.startTime).toFixed(2)}ms`,
        ...(index > 0 && {
          stepDuration: cp.timestamp - this.marks[index - 1].timestamp,
          stepDurationFormatted: `${(cp.timestamp - this.marks[index - 1].timestamp).toFixed(2)}ms`,
        }),
        ...(cp.memory && {
          memory: {
            heap: formatMemMB(cp.memory.heapUsed),
            rss: formatMemMB(cp.memory.rss),
          },
        }),
        gcTriggered: cp.gcTriggered,
      })),
      steps,
      memDeltas: memDeltas.map((md) => ({
        from: md.from,
        to: md.to,
        duration: `${md.duration.toFixed(2)}ms`,
        heapDelta: `${md.delta.heapUsed >= 0 ? '+' : ''}${formatMemMB(md.delta.heapUsed)}`,
        rssDelta: `${md.delta.rss >= 0 ? '+' : ''}${formatMemMB(md.delta.rss)}`,
      })),
    };

    // Enhanced logging with phase durations
    const slowestSteps = steps
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map((p) => `${p.step}: ${p.durationFormatted}`);

    // Only log completion summary if logging is enabled
    if (!this.config.silent) {
      this.log(`Profiler completed: ${this.name}`, {
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        marks: this.marks.length,
        steps: steps.length,
        gcTriggered: this.gcCount,
        ...(slowestSteps.length > 0 && { slowestSteps }),
        tags: this.config.tags,
      });
    }

    return summary;
  }

  private log(message: string, data?: Record<string, unknown>): void {
    const logger = this.config.logger;
    const logLevel = this.config.logLevel;

    if (logLevel && logger && typeof (logger as Logger)[logLevel] === 'function') {
      (logger as Logger)[logLevel]!({ message, ...data });
    } else if (logger && typeof (logger as Console).log === 'function') {
      (logger as Console).log({ message, ...data });
    } else {
      console.log({ message, ...data });
    }
  }
}

/**
 * Utility function to monitor memory leaks
 * Useful for detecting memory growth patterns
 */
export function detectMemLeak(
  measurements: NodeJS.MemoryUsage[],
  threshold: number = 50, // MB
): {
  isLeaking: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
  avgGrowth: number;
} {
  if (measurements.length < 2) {
    return { isLeaking: false, trend: 'stable', avgGrowth: 0 };
  }

  const deltas = [];
  for (let i = 1; i < measurements.length; i++) {
    const delta = measurements[i].heapUsed - measurements[i - 1].heapUsed;
    deltas.push(delta);
  }

  const avgGrowth = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  const avgGrowthMB = avgGrowth / 1024 / 1024;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (avgGrowthMB > 1) trend = 'increasing';
  else if (avgGrowthMB < -1) trend = 'decreasing';

  const isLeaking = avgGrowthMB > threshold;

  return {
    isLeaking,
    trend,
    avgGrowth: avgGrowthMB,
  };
}
