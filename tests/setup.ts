// Test setup file
// Add any global test configuration here

// Mock console to avoid noise in tests
const originalConsole = global.console;

beforeEach(() => {
  global.console = {
    ...originalConsole,
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
});

afterEach(() => {
  global.console = originalConsole;
  jest.clearAllMocks();
});
