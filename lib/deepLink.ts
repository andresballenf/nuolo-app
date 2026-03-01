import * as Linking from 'expo-linking';

export interface ParsedDeepLink {
  path: string | null;
  queryParams: Record<string, string>;
  hashParams: Record<string, string>;
  hasSessionTokens: boolean;
}

function normalizePath(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed.length > 0 ? trimmed : null;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseQueryLikeString(source: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const part of source.split('&')) {
    const [rawKey, ...rawValue] = part.split('=');
    if (!rawKey) continue;
    const key = decodeSafe(rawKey);
    const value = decodeSafe(rawValue.join('='));
    output[key] = value;
  }
  return output;
}

function extractPathFromRawUrl(url: string): string | null {
  const authPathMatch = url.match(/(?:^|\/)(auth\/[A-Za-z0-9-_./]+)/);
  if (authPathMatch?.[1]) {
    return normalizePath(authPathMatch[1]);
  }
  return null;
}

export function parseDeepLink(url: string): ParsedDeepLink {
  const parsed = Linking.parse(url);

  const queryParams: Record<string, string> = {};
  if (parsed.queryParams) {
    for (const [key, value] of Object.entries(parsed.queryParams)) {
      if (typeof value === 'string') {
        queryParams[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        queryParams[key] = String(value[0]);
      } else if (value != null) {
        queryParams[key] = String(value);
      }
    }
  }

  const hashParams: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0 && hashIndex < url.length - 1) {
    const hash = url.slice(hashIndex + 1);
    const normalizedHash = hash.startsWith('/') && hash.includes('?')
      ? hash.slice(hash.indexOf('?') + 1)
      : hash;
    Object.assign(hashParams, parseQueryLikeString(normalizedHash));
  }

  const normalizedParsedPath = normalizePath(parsed.path);
  const normalizedPath =
    (parsed.hostname === 'auth'
      ? normalizePath(`auth/${normalizedParsedPath ?? ''}`)
      : null) ||
    normalizedParsedPath ||
    extractPathFromRawUrl(url);

  return {
    path: normalizedPath,
    queryParams,
    hashParams,
    hasSessionTokens: Boolean(hashParams.access_token && hashParams.refresh_token),
  };
}
