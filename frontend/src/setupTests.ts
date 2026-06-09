// src/setupTests.ts
import '@testing-library/jest-dom';
// Keep setup minimal; avoid mocking ESM-only modules globally to prevent Jest resolution issues.

// Mock window.matchMedia which is not available in jsdom but required by Ant Design.
// The implementation needs to return a valid MediaQueryList object with `matches`.
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated but still used by antd
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});
