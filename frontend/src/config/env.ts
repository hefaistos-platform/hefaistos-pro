const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const readNodeEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  return process.env[key];
};

const readEnv = (viteKey: string, legacyKey: string): string | undefined => {
  return readNodeEnv(viteKey) || readNodeEnv(legacyKey);
};

export const isDevEnvironment = (): boolean => {
  const mode = readNodeEnv('NODE_ENV');
  return !mode || mode === 'development' || mode === 'test';
};

export const getApiBaseUrl = (): string => {
  const configured = readEnv('VITE_API_URL', 'REACT_APP_API_URL');
  if (configured && configured.trim().length > 0) {
    return trimTrailingSlash(configured);
  }
  return typeof window !== 'undefined' ? trimTrailingSlash(window.location.origin) : '';
};

export const getNavigatorBaseUrl = (): string | undefined => {
  const configured = readEnv('VITE_NAVIGATOR_URL', 'REACT_APP_NAVIGATOR_URL');
  if (configured && configured.trim().length > 0) {
    return configured;
  }
  return undefined;
};

/**
 * Returns the default redirect URI to pre-populate in the Authentication
 * configuration form when no value has been saved yet.
 *
 * Both Entra and Generic OIDC use the same callback path: <origin>/login.
 * The origin is derived from VITE_API_URL / REACT_APP_API_URL when set, or
 * falls back to window.location.origin at runtime.
 *
 * This value must be registered exactly (scheme + host + path) in the IdP
 * application settings (Entra App Registration / OIDC client config).
 */
export const computeDefaultRedirectUri = (): string => {
  const base = getApiBaseUrl();
  return base ? `${base}/login` : '';
};
