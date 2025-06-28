# @crudmates/profiler

A comprehensive performance profiling utility for Node.js applications that provides timing, memory monitoring, and garbage collection tracking capabilities. This package offers multiple tools to help you understand and optimize your application's performance.

## Features

- ⚡ **Performance Profiling**: Measure execution time of functions and code blocks
- 📊 **Memory Monitoring**: Track memory usage and detect potential memory leaks
- 🗑️ **Garbage Collection**: Monitor and trigger GC when needed
- 🎯 **Checkpoints**: Create detailed performance marks and measure intervals
- 📝 **Flexible Logging**: Configurable logging levels and output formats
- 🔄 **Async Support**: Full support for async/await operations
- 🎨 **TypeScript**: Written in TypeScript with full type definitions

## Installation

```bash
npm install @crudmates/profiler
```

## Quick Start

```typescript
import { profile, Timer, MemMonitor, Profiler } from '@crudmates/profiler';

// Basic function profiling
const { result, profile: stats } = await profile(async () => await fetchData(), 'fetchData', {
  trackMemory: true,
});

// Quick timing
const timer = new Timer('operation');
// ... do work ...
timer.stop();
```

## Usage Guide

### 1. Function Profiling

The `profile` function is the simplest way to measure performance of a specific function or code block.

```typescript
import { profile } from '@crudmates/profiler';

// Basic usage
const { result, profile: stats } = await profile(() => expensiveOperation(), 'expensiveOperation');

// With configuration
const { result, profile: stats } = await profile(() => databaseQuery(), 'databaseQuery', {
  trackMemory: true, // Enable memory tracking
  enableGC: true, // Enable garbage collection
  gcThresholdMB: 100, // Trigger GC when heap usage exceeds 100MB
  tags: {
    // Add custom tags
    operation: 'database',
    type: 'query',
  },
  logLevel: 'debug', // Set log level
  verbose: true, // Enable detailed logging
  silent: false, // Enable logging
});

// The profile result contains:
console.log(stats);
// {
//   name: 'databaseQuery',
//   duration: 123.45,        // in milliseconds
//   memBefore: {...},        // memory usage before execution
//   memAfter: {...},         // memory usage after execution
//   memDelta: {...},         // memory usage difference
//   gcTriggered: false,      // whether GC was triggered
//   tags: {...},             // custom tags
//   result: {...},           // function result
//   error: undefined         // error if thrown
// }
```

### 2. Method Decorator

For class methods, you can use the `@Profile` decorator:

```typescript
import { Profile } from '@crudmates/profiler';

class UserService {
  @Profile('fetchUsers', {
    trackMemory: true,
    enableGC: true,
    tags: { operation: 'database-query' },
  })
  async fetchUsers() {
    // Method implementation
    return await this.userRepository.find();
  }
}
```

### 3. Simple Timer

The `Timer` class provides a lightweight way to measure execution time:

```typescript
import { Timer } from '@crudmates/profiler';

// Basic usage
const timer = new Timer('operation-name');
// ... do work ...
const duration = timer.stop();

// With additional data
timer.stop({ recordCount: 1000 });

// Static method
const result = await Timer.time(async () => await processData(), 'processData');
```

### 4. Memory Monitoring

The `MemMonitor` class helps track memory usage over time:

```typescript
import { MemMonitor } from '@crudmates/profiler';

const monitor = new MemMonitor();

// Take snapshots
monitor.snap('start');
await processLargeDataset();
monitor.snap('processing-complete');
await cleanupOperation();
monitor.snap('cleanup-complete');

// Compare specific points
monitor.compare('start', 'processing-complete');

// Get all snapshots
const snapshots = monitor.getSnaps();

// Clear snapshots
monitor.clear();
```

### 5. Advanced Profiling

The `Profiler` class provides comprehensive profiling for complex operations:

```typescript
import { Profiler } from '@crudmates/profiler';

const profiler = new Profiler('batch-processing', {
  enableGC: true,
  gcThresholdMB: 100,
  logSteps: true,
});

// Start profiling
profiler.start();

// Add marks during processing
for (const batch of batches) {
  profiler.mark(`processing-batch-${batch.id}`);
  await processBatch(batch);
}

// Get current summary without ending
const currentStatus = profiler.getSummary();

// Get detailed step breakdown
const steps = profiler.getSteps();

// End profiling and get full report
const summary = profiler.end();
// Summary includes:
// - Total duration
// - GC count
// - Detailed marks with timestamps
// - Memory deltas between marks
// - Step-by-step breakdown
```

### 6. Memory Leak Detection

The utility includes a helper function to detect potential memory leaks:

```typescript
import { detectMemLeak } from '@crudmates/profiler';

// Collect memory measurements
const measurements: NodeJS.MemoryUsage[] = [];
for (let i = 0; i < 10; i++) {
  measurements.push(process.memoryUsage());
  await someOperation();
}

// Analyze measurements
const analysis = detectMemLeak(measurements, 50); // 50MB threshold
console.log(analysis);
// {
//   isLeaking: boolean,
//   trend: 'increasing' | 'decreasing' | 'stable',
//   avgGrowth: number // Average growth in MB
// }
```

## Configuration Options

### Profile Config

| Option          | Type                          | Default | Description                          |
| --------------- | ----------------------------- | ------- | ------------------------------------ |
| `trackMemory`   | boolean                       | true    | Enable memory usage tracking         |
| `enableGC`      | boolean                       | false   | Enable garbage collection monitoring |
| `gcThresholdMB` | number                        | 100     | Memory threshold to trigger GC       |
| `logger`        | Logger \| Console             | console | Logger instance to use               |
| `tags`          | Record<string, unknown>       | {}      | Custom tags for logging              |
| `logLevel`      | 'debug' \| 'log' \| 'verbose' | 'debug' | Log level for output                 |
| `logSteps`      | boolean                       | true    | Log individual checkpoints           |
| `verbose`       | boolean                       | false   | Enable detailed intermediate steps   |
| `silent`        | boolean                       | false   | Disable all logging                  |

## Best Practices

1. **Memory Tracking**: Enable `trackMemory` when profiling memory-intensive operations
2. **Garbage Collection**:
   - Always run Node.js with `--expose-gc` when using GC features
   - Use `enableGC` carefully as it can impact performance
   - Consider higher `gcThresholdMB` values in production
3. **Logging**:
   - Use `verbose: true` when you need detailed step-by-step information
   - Use `logLevel: 'verbose'` for most detailed logging output
   - Consider disabling verbose mode in production for better performance
4. **Marks**: Add meaningful marks in long-running operations for better analysis
5. **Custom Tags**: Add relevant tags to help categorize and filter profiling data

## Requirements

- Node.js >= 14.0.0
- TypeScript >= 5.0.0 (for TypeScript users)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
