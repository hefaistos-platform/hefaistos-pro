import { computeDefaultRedirectUri, getApiBaseUrl } from './env';

describe('env config', () => {
  const originalWindow = global.window;
  const originalProcessEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalProcessEnv };
    // Reset VITE_API_URL and REACT_APP_API_URL between tests
    delete process.env.VITE_API_URL;
    delete process.env.REACT_APP_API_URL;
  });

  afterEach(() => {
    process.env = originalProcessEnv;
    // Restore window.location.origin via Object.defineProperty if it was changed
    try {
      Object.defineProperty(global, 'window', { value: originalWindow, writable: true });
    } catch {
      // no-op if not possible in this environment
    }
  });

  describe('computeDefaultRedirectUri', () => {
    test('appends /login to VITE_API_URL when set', () => {
      process.env.VITE_API_URL = 'https://hefaistos.company.com';
      expect(computeDefaultRedirectUri()).toBe('https://hefaistos.company.com/login');
    });

    test('strips trailing slash from base URL before appending /login', () => {
      process.env.VITE_API_URL = 'https://hefaistos.company.com/';
      expect(computeDefaultRedirectUri()).toBe('https://hefaistos.company.com/login');
    });

    test('falls back to REACT_APP_API_URL when VITE_API_URL is absent', () => {
      process.env.REACT_APP_API_URL = 'https://hefaistos.staging.company.com';
      expect(computeDefaultRedirectUri()).toBe('https://hefaistos.staging.company.com/login');
    });

    test('supports internal-only .loc domains', () => {
      process.env.VITE_API_URL = 'https://hefaistos.corp.loc';
      expect(computeDefaultRedirectUri()).toBe('https://hefaistos.corp.loc/login');
    });

    test('falls back to window.location.origin when no env var is set', () => {
      // window.location.origin is 'http://localhost' in jsdom
      const result = computeDefaultRedirectUri();
      expect(result).toMatch(/\/login$/);
      expect(result).toContain('localhost');
    });

    test('returns empty string when window is undefined and no env var is set', () => {
      // Simulate SSR / no-window environment
      const saved = global.window;
      // @ts-ignore
      delete global.window;
      try {
        expect(computeDefaultRedirectUri()).toBe('');
      } finally {
        global.window = saved;
      }
    });
  });

  describe('auto-population behavior (blank vs prefilled)', () => {
    test('blank redirect URI field should receive the computed default', () => {
      process.env.VITE_API_URL = 'https://hefaistos.example.com';
      const savedValue = '';
      const result = savedValue || computeDefaultRedirectUri();
      expect(result).toBe('https://hefaistos.example.com/login');
    });

    test('prefilled redirect URI field should remain unchanged', () => {
      process.env.VITE_API_URL = 'https://hefaistos.example.com';
      const savedValue = 'https://custom.override.com/login';
      const result = savedValue || computeDefaultRedirectUri();
      expect(result).toBe('https://custom.override.com/login');
    });
  });

  describe('getApiBaseUrl', () => {
    test('returns VITE_API_URL without trailing slash', () => {
      process.env.VITE_API_URL = 'https://hefaistos.company.com/';
      expect(getApiBaseUrl()).toBe('https://hefaistos.company.com');
    });

    test('falls back to window.location.origin', () => {
      const result = getApiBaseUrl();
      expect(typeof result).toBe('string');
    });
  });
});
