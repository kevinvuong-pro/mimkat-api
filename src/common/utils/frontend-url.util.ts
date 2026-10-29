import type { Request } from 'express';

export function getAllowedFrontendOrigins(): string[] {
  const configuredOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => origin !== '*');

  return configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:3001', 'http://localhost:3002'];
}

export function isAllowedFrontendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      getAllowedFrontendOrigins().includes(parsed.origin)
    );
  } catch {
    return false;
  }
}

export function extractFrontendUrl(req: Request): string {
  // Try origin header first (most reliable for CORS requests)
  if (req.headers.origin && isValidUrl(req.headers.origin)) return req.headers.origin;

  // Fallback to referer header
  if (req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      return `${refererUrl.protocol}//${refererUrl.host}`;
    } catch {
      // Fall through to the configured development default.
    }
  }

  // Default fallback when headers are missing (development only - should not happen in production)
  return getAllowedFrontendOrigins()[0] || 'http://localhost:3001';
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
