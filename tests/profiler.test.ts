import { detectMemLeak, MemMonitor, Profile, profile, Profiler, Timer } from '../src/index';

describe('profileFunction', () => {
  it('should profile a synchronous function', async () => {
    const testFn = () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    };

    const { result, profile: profileResult } = await profile(testFn, 'testFunction');

    expect(result).toBe(499500); // sum of 0 to 999
    expect(profileResult.name).toBe('testFunction');
    expect(profileResult.duration).toBeGreaterThan(0);
    expect(profileResult.memBefore).toBeDefined();
    expect(profileResult.memAfter).toBeDefined();
  });

  it('should profile an async function', async () => {
    const asyncFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'completed';
    };

    const { result, profile: profileResult } = await profile(asyncFn, 'asyncFunction');

    expect(result).toBe('completed');
    expect(profileResult.duration).toBeGreaterThan(5); // More lenient timing test
  });

  it('should handle function errors', async () => {
    const errorFn = () => {
      throw new Error('Test error');
    };

    await expect(profile(errorFn, 'errorFunction')).rejects.toThrow('Test error');
  });
});

describe('Profile decorator', () => {
  class TestService {
    @Profile('testMethod')
    async testMethod(value: number): Promise<number> {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return value * 2;
    }
  }

  it('should profile decorated methods', async () => {
    const service = new TestService();
    const result = await service.testMethod(5);
    expect(result).toBe(10);
  });
});

describe('Timer', () => {
  it('should measure elapsed time', () => {
    const timer = new Timer('test-timer');
    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // busy wait for ~10ms
    }
    const duration = timer.stop();
    expect(duration).toBeGreaterThanOrEqual(5);
  });

  it('should work with static time method', async () => {
    const result = await Timer.time(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'done';
    }, 'static-timer');
    expect(result).toBe('done');
  });
});

describe('MemoryMonitor', () => {
  it('should take memory snapshots', () => {
    const monitor = new MemMonitor();
    const usage = monitor.snap('test-snapshot');

    expect(usage).toBeDefined();
    expect(usage.heapUsed).toBeGreaterThan(0);
    expect(usage.rss).toBeGreaterThan(0);

    const snapshots = monitor.getSnaps();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].label).toBe('test-snapshot');
  });

  it('should compare snapshots', () => {
    const monitor = new MemMonitor();
    monitor.snap('start');

    // Allocate some memory
    const largeArray = new Array(1000).fill('test');

    monitor.snap('after-allocation');
    monitor.compare('start', 'after-allocation');

    // Should not throw
    expect(largeArray).toBeDefined();
  });
});

describe('Profiler', () => {
  it('should handle checkpoints', () => {
    const profiler = new Profiler('test-profiler', {
      silent: true,
      verbose: false,
    });

    profiler.start();
    profiler.mark('step1');
    profiler.mark('step2');

    const summary = profiler.end();

    expect(summary.name).toBe('test-profiler');
    expect(summary.totalDuration).toBeGreaterThan(0);
    expect(summary.marks).toHaveLength(4); // start, step1, step2, end
  });

  it('should provide current summary', () => {
    const profiler = new Profiler('test-profiler', {
      silent: true,
      verbose: false,
    });

    profiler.start();
    profiler.mark('step1');

    const currentSummary = profiler.getSummary();
    expect(currentSummary.name).toBe('test-profiler');
    expect(currentSummary.markCount).toBe(2); // start + step1
  });

  it('should log detailed steps when verbose is true', () => {
    const mockLogger = {
      debug: jest.fn(),
      log: jest.fn(),
    };

    const profiler = new Profiler('test-profiler', {
      logger: mockLogger,
      verbose: true,
    });

    profiler.start();
    profiler.mark('step1');
    profiler.end();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Mark: step1'),
      }),
    );
  });

  it('should not log steps when verbose is false', () => {
    const mockLogger = {
      debug: jest.fn(),
      log: jest.fn(),
    };

    const profiler = new Profiler('test-profiler', {
      logger: mockLogger,
      verbose: false,
    });

    profiler.start();
    profiler.mark('step1');
    profiler.end();

    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Mark: step1'),
      }),
    );
  });
});

describe('detectMemoryLeak', () => {
  it('should detect stable memory usage', () => {
    const measurements: NodeJS.MemoryUsage[] = [
      { heapUsed: 1000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
      { heapUsed: 1000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
      { heapUsed: 1000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
    ];

    const result = detectMemLeak(measurements);
    expect(result.isLeaking).toBe(false);
    expect(result.trend).toBe('stable');
  });

  it('should detect increasing memory usage', () => {
    const measurements: NodeJS.MemoryUsage[] = [
      { heapUsed: 1000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
      { heapUsed: 60000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
      { heapUsed: 120000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
    ];

    const result = detectMemLeak(measurements, 10); // Low threshold for testing
    expect(result.isLeaking).toBe(true);
    expect(result.trend).toBe('increasing');
  });

  it('should handle insufficient measurements', () => {
    const measurements: NodeJS.MemoryUsage[] = [
      { heapUsed: 1000000, heapTotal: 2000000, external: 100000, rss: 3000000, arrayBuffers: 0 },
    ];

    const result = detectMemLeak(measurements);
    expect(result.isLeaking).toBe(false);
    expect(result.trend).toBe('stable');
    expect(result.avgGrowth).toBe(0);
  });
});
