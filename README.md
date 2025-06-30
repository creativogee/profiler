# @crudmates/profiler

A comprehensive Node.js profiler that combines function-level timing, V8 performance analysis, and memory monitoring in a production-safe package. Designed for both development debugging and continuous production monitoring.

## Installation

```bash
npm install @crudmates/profiler
```

## The Complete Toolkit

### ⚡ Function Profiling - For Individual Operations

Perfect for profiling API endpoints, database queries, or any specific function:

```typescript
import { profile } from '@crudmates/profiler';

// Profile any function with timing + memory
const { result, profile: stats } = await profile(
  () => expensiveOperation(),
  'expensiveOperation',
  {
    trackMemory: true,
    enableGC: true,
    tags: { operation: 'database' }
  }
);

console.log(`${stats.name} took ${stats.duration}ms`);
console.log(`Memory delta: ${stats.memDelta?.heapUsed}MB`);
```

### 🔬 V8 Profiler - For Application-Level Analysis  

**NEW!** Deep performance analysis for production applications:

```typescript
import { V8Profiler } from '@crudmates/profiler';

// Start continuous profiling with automatic 60-min intervals
const v8Profiler = new V8Profiler('production-api', {
  maxMemoryBudgetMB: 100,        // Hard memory limit
  intervalMinutes: 60,           // Auto-log every hour  
  cpuProfiling: true,           // Find performance bottlenecks
  samplingHeapProfiler: true,   // Track memory allocations
});

await v8Profiler.startContinuousProfiling();
// Runs indefinitely, logs insights every 60 minutes
// Zero memory buildup, actionable insights only

// Later...
const insights = await v8Profiler.stopContinuousProfiling();
console.log('Top CPU consumers:', insights.topFunctions);
console.log('Memory hot spots:', insights.memoryHotspots);
```

### 📊 Method Decorator - For Class Methods

Zero-friction profiling with decorators:

```typescript
import { Profile } from '@crudmates/profiler';

class UserService {
  @Profile('fetchUsers', { trackMemory: true })
  async fetchUsers() {
    return await this.userRepository.find();
  }
}
```

### ⏱️ Timer - For Quick Measurements

Lightweight timing without overhead:

```typescript
import { Timer } from '@crudmates/profiler';

const timer = new Timer('database-query');
const users = await db.users.find();
timer.stop({ userCount: users.length });

// Or static method
const result = await Timer.time(() => processData(), 'processData');
```

### 🧠 Memory Monitor - For Memory Analysis

Track memory usage patterns over time:

```typescript
import { MemMonitor } from '@crudmates/profiler';

const monitor = new MemMonitor();
monitor.snap('start');
await processLargeDataset();
monitor.snap('after-processing');
monitor.compare('start', 'after-processing');
```

### 🎯 Advanced Profiler - For Complex Workflows

Multi-step profiling with checkpoints:

```typescript
import { Profiler } from '@crudmates/profiler';

const profiler = new Profiler('batch-processing', {
  enableGC: true,
  gcThresholdMB: 100
});

profiler.start();
for (const batch of batches) {
  profiler.mark(`processing-batch-${batch.id}`);
  await processBatch(batch);
}
const summary = profiler.end();
```

## V8Profiler: Production-Grade Performance Analysis

The **V8Profiler** sets this package apart from basic timing libraries. It provides the deep insights of clinic.js or 0x, but designed for **continuous production monitoring**:

### 🎛️ Smart Configuration

```typescript
const profiler = new V8Profiler('my-app', {
  maxMemoryBudgetMB: 50,         // Required: Hard memory limit
  intervalMinutes: 120,          // Custom interval (2 hours)
  cpuProfiling: true,           // CPU bottleneck analysis  
  samplingHeapProfiler: true,   // Memory allocation tracking
  suppressWarnings: false       // Get configuration guidance
});
```

### 📈 Actionable Insights (Not Raw Data)

Unlike tools that dump massive profile files, we return **structured insights**:

```typescript
const insights = await profiler.flushCurrentInterval();

// CPU Performance
insights.topFunctions.forEach(fn => {
  console.log(`${fn.functionName}: ${fn.selfTime}ms (${fn.percentage}%)`);
});

// Memory Analysis  
insights.memoryHotspots.forEach(spot => {
  console.log(`${spot.allocation}: ${spot.size} bytes (${spot.count} allocations)`);
});

// Current memory state
console.log(`Heap: ${insights.memoryUsage.heap}`);
console.log(`RSS: ${insights.memoryUsage.rss}`);
```

### 🔒 Memory Safety First

The **maxMemoryBudgetMB** requirement prevents profiling from becoming the problem:

```typescript
// ✅ Safe - enforces memory limits
const profiler = new V8Profiler('app', {
  maxMemoryBudgetMB: 100,  // Required parameter
  intervalMinutes: 240     // 4 hours
});

// ⚠️ Gets helpful warnings:
// "High memory risk: 240min interval may use ~360MB, approaching limit of 100MB"
// "Consider: reducing intervalMinutes to 53 or increasing maxMemoryBudgetMB to 432"
```

## Memory Leak Detection

Built-in leak detection for proactive monitoring:

```typescript
import { detectMemLeak } from '@crudmates/profiler';

const measurements = [];
for (let i = 0; i < 10; i++) {
  measurements.push(process.memoryUsage());
  await someOperation();
}

const analysis = detectMemLeak(measurements, 50); // 50MB threshold
if (analysis.isLeaking) {
  console.warn(`Memory leak detected! Trend: ${analysis.trend}, Growth: ${analysis.avgGrowth}MB`);
}
```

## How Does This Compare to Other Profilers?

| Feature | `@crudmates/profiler` | `clinic.js` | `0x` | `--prof` | `perf_hooks` |
|---------|:---------------------:|:-----------:|:----:|:--------:|:------------:|
| Function-level timing | ✅ | ❌ | ❌ | ❌ | ⚠️ Manual |
| V8 CPU profiling | ✅ | ✅ | ✅ | ✅ | ❌ |
| Memory allocation tracking | ✅ | ✅ | ❌ | ❌ | ❌ |
| Zero disk writes | ✅ | ❌ | ❌ | ❌ | ✅ |
| Production-safe intervals | ✅ | ❌ | ❌ | ❌ | ❌ |
| Memory budget protection | ✅ | ❌ | ❌ | ❌ | ❌ |
| TypeScript native | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| Async/await support | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Single dependency | ✅ | ❌ | ❌ | ✅ | ✅ |

## Why Choose This Profiler?

### 🚀 **Complete Profiling Spectrum**
Most profilers focus on either basic timing or complex V8 analysis. This package provides both:

- **Function-level profiling** (microseconds) - For API endpoints, database queries
- **Application-level V8 profiling** (minutes/hours) - Deep CPU and memory analysis
- **Memory monitoring** with leak detection - Real-time tracking without overhead
- **Checkpoint system** for complex workflows - Mark and measure any process step-by-step

### 🛡️ **Production-Safe by Design**
Many profilers can impact performance or consume excessive resources:

- **Zero disk I/O** - Everything stays in memory with configurable budgets
- **Memory budget enforcement** - Hard limits prevent profiling from causing issues
- **Automatic interval flushing** - Long-running profiling without memory buildup
- **Smart configuration warnings** - Helps avoid problematic settings

### 🎯 **Built for Real Applications**
Features that matter for production use:

- **Async/await native** - No callback hell or promise wrapping
- **TypeScript first** - Full type safety and IntelliSense
- **Production logging integration** - Works with your existing logger
- **Configurable everything** - From silent mode to verbose debugging

**Key insight:** While other tools excel in specific areas, this profiler bridges the gap between development debugging and production monitoring, with built-in safety features to prevent profiling from impacting your application's performance.

## Configuration Reference

### ProfileConfig (function profiling)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trackMemory` | boolean | true | Enable memory usage tracking |
| `enableGC` | boolean | false | Enable garbage collection monitoring |
| `gcThresholdMB` | number | 100 | Memory threshold to trigger GC |
| `logger` | Logger \| Console | console | Custom logger instance |
| `tags` | Record<string, unknown> | {} | Custom tags for categorization |
| `logLevel` | 'debug' \| 'log' \| 'verbose' | 'debug' | Logging verbosity |
| `verbose` | boolean | false | Detailed step-by-step logging |
| `silent` | boolean | false | Disable all logging output |

### V8Options (V8 profiling)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxMemoryBudgetMB` | number | **Required** | Hard memory limit for profiling data |
| `intervalMinutes` | number | 60 | Auto-flush interval (prevents buildup) |
| `cpuProfiling` | boolean | true | Enable CPU performance analysis |
| `samplingHeapProfiler` | boolean | true | Enable memory allocation tracking |
| `streamingMode` | boolean | true | Process data incrementally |
| `suppressWarnings` | boolean | false | Hide configuration warnings |
| `logger` | Logger \| Console | console | Custom logger instance |

## Best Practices

### 🎯 Function Profiling
- Use for individual operations (< 1 minute duration)
- Enable `trackMemory` for memory-intensive operations
- Add meaningful `tags` for categorization

### 🔬 V8 Profiling  
- Use for application-level analysis (> 1 minute duration)
- Start with 60-minute intervals in production
- Set `maxMemoryBudgetMB` based on available system memory
- Use `suppressWarnings: true` once configuration is stable

### 💾 Memory Management
- Always run with `--expose-gc` when using GC features
- Monitor memory trends with `detectMemLeak()`
- Use higher `gcThresholdMB` values in production

### 📝 Logging
- Use `verbose: true` for debugging, `silent: true` for production
- Integrate with your application's logger instance
- Add contextual tags for better filtering

## Requirements

- **Node.js** >= 14.0.0
- **TypeScript** >= 5.0.0 (for TypeScript users)
- Run with `--expose-gc` for garbage collection features
- Run with `--inspect` for V8 profiling features (development)

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Ready to optimize your Node.js applications?** Install `@crudmates/profiler` and start profiling with confidence! 🚀