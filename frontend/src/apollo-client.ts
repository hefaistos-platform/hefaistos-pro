import { ApolloClient, InMemoryCache, from, ApolloLink, Observable } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { logGraphQLError } from './utils/errorHandling';
import { print } from 'graphql';
import { getApiBaseUrl, isDevEnvironment } from './config/env';

// --- Custom Upload Link (prevents JSON.stringify from stripping File objects) ---
const uploadLink = new ApolloLink(operation => {
  return new Observable(observer => {
    const { query, variables, operationName } = operation;
    const context = operation.getContext();
    // Use configured API URL if provided, otherwise same-origin fallback
    const baseApiUrl = getApiBaseUrl();
    const uri = `${baseApiUrl}/graphql`;
    const headers = { ...(context.headers || {}) };

    const isFile = (v: any) => (typeof File !== 'undefined' && v instanceof File) || (typeof Blob !== 'undefined' && v instanceof Blob);
    let hasFile = false;
    const fileMap: { index: number; paths: string[]; file: File|Blob }[] = [];

    const walk = (obj: any, path: string[]) => {
      if (!obj) return;
      if (isFile(obj)) {
        hasFile = true;
        fileMap.push({ index: fileMap.length, paths: [ 'variables.' + path.join('.') ], file: obj });
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => walk(item, [...path, String(i)]));
      } else if (typeof obj === 'object') {
        Object.entries(obj).forEach(([k, v]) => walk(v, [...path, k]));
      }
    };
    walk(variables, []);

    let body: BodyInit;
    if (hasFile) {
      const formData = new FormData();
      // Build operations with null placeholders for file paths
      const operations: any = {
        query: print(query),
        variables: JSON.parse(JSON.stringify(variables, (_k, v) => (isFile(v) ? null : v))),
        operationName: operationName || null,
      };
      const map: Record<string, string[]> = {};
      fileMap.forEach(({ index, paths, file }) => {
        map[String(index)] = paths;
        formData.append(String(index), file);
      });
      formData.append('operations', JSON.stringify(operations));
      formData.append('map', JSON.stringify(map));
      // Delete content-type header so browser sets boundary
      delete (headers as any)['content-type'];
      delete (headers as any)['Content-Type'];
      body = formData;
    } else {
      body = JSON.stringify({ query: print(query), variables, operationName });
      headers['content-type'] = 'application/json';
    }

    fetch(uri, {
      method: 'POST',
      headers,
      body
      // Removed credentials: 'include' since we use Bearer token auth, not cookies
    })
      .then(async response => {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch (_) {
          try {
            const text = await response.text();
            payload = { errors: [{ message: text || `HTTP ${response.status}` }], data: null };
          } catch {
            payload = { errors: [{ message: `HTTP ${response.status}` }], data: null };
          }
        }

        // Always deliver a result to Apollo; errorLink will process errors
        observer.next(payload);
        observer.complete();
      })
      .catch(err => {
        observer.error(err);
      });
  });
});

// Dev logging link for operations (query, variables)
const logLink = new ApolloLink((operation, forward) => {
  // Only log in development to avoid noisy consoles in prod
  if (isDevEnvironment()) {
    // eslint-disable-next-line no-console
    console.group(`Apollo Operation: ${operation.operationName || 'Unnamed'}`);
    // eslint-disable-next-line no-console
    console.info('Variables:', operation.variables);
    try {
      // eslint-disable-next-line no-console
      console.info('Query:\n', print(operation.query));
    } catch (_) {
      // ignore print errors
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
  return forward(operation);
});

// Removed createHttpLink – uploadLink handles both file & non-file operations.

// Add authentication headers — only include Authorization when a token is present.
// Sending Authorization: "" (empty string) can cause JWT middleware to throw
// instead of treating the request as anonymous.
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  }
});

// Add error handling
const errorLink = onError((error: any) => {
  const { graphQLErrors, networkError, operation } = error || {};

  // operation.getContext is a function that returns the context for the operation
  const opContext = typeof operation?.getContext === 'function'
    ? operation.getContext()
    : operation?.getContext;

  // Log the component name if available from the context
  const componentName = opContext?.componentName || 'Unknown Component';

  if (graphQLErrors?.length) {
    graphQLErrors.forEach((gqlError: any) => {
      logGraphQLError(gqlError, componentName);
    });
  }

  if (networkError) {
    logGraphQLError({
      message: (networkError as any).message || 'Network error occurred',
      name: (networkError as any).name || 'NetworkError',
      // include the wrapped networkError for deeper debugging
      networkError: networkError
    }, componentName);
    // eslint-disable-next-line no-console
    if (isDevEnvironment()) console.debug('Network error full object:', networkError);
  }
});

// Initialize cache with custom scalar handling
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // UUID fields should be treated as strings
        id: {
          read(value) {
            return value ? String(value) : value;
          }
        }
      }
    },
    // Handle IDs in UserType (the GraphQL type name exposed by the backend)
    UserType: {
      fields: {
        id: {
          read(value) {
            return value ? String(value) : value;
          }
        }
      }
    },
    PlaybookGraph: {
      fields: {
        id: {
          read(value) {
            return value ? String(value) : value;
          }
        }
      }
    },
    // Add more types as needed
  }
});

// Create Apollo Client with error handling
const client = new ApolloClient({
  link: from([errorLink, logLink, authLink, uploadLink]),
  cache,
  defaultOptions: {
    watchQuery: {
      // Add component names to the context for error tracking
      context: {
        componentName: 'Unknown Component'
      },
      errorPolicy: 'all'
    },
    query: {
      // Add component names to the context for error tracking
      context: {
        componentName: 'Unknown Component'
      },
      errorPolicy: 'all'
    },
    mutate: {
      // Add component names to the context for error tracking
      context: {
        componentName: 'Unknown Component'
      }
    }
  }
});

export default client;
