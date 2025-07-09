/**
 * Polyfill for Node.js 18.8.0 multipart/form-data support
 * This replaces the built-in fetch with undici@6.20.0 to fix the
 * "NotSupportedError: multipart/form-data not supported" issue
 */

import undici from 'undici';
const { fetch, FormData, File, Blob, Headers, Request, Response } = undici;

// Only polyfill if we're in Node.js environment (server-side)
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
    // Replace global fetch and related APIs with undici versions
    globalThis.fetch = fetch;
    globalThis.FormData = FormData;
    globalThis.Headers = Headers;
    globalThis.Request = Request;
    globalThis.Response = Response;
    
    // Also set File and Blob if they don't exist or are problematic
    if (!globalThis.File || !globalThis.Blob) {
        globalThis.File = File;
        globalThis.Blob = Blob;
    }
    
    console.log('✓ Undici polyfill loaded - multipart/form-data support enabled');
}
