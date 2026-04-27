import * as fc from 'fast-check';

// Configure fast-check globally
fc.configureGlobal({
  numRuns: 100, // Run each property test 100 times
  verbose: true,
});

// Global test timeout for property-based tests
jest.setTimeout(30000);
