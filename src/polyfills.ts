/* eslint-disable  @typescript-eslint/no-explicit-any */
import undici from 'undici';
const { fetch, FormData, Headers, Request, Response } = undici;

if (typeof window === 'undefined') {
	globalThis.fetch = fetch as any;
	globalThis.FormData = FormData as any;
	globalThis.Headers = Headers as any;
	globalThis.Request = Request as any;
	globalThis.Response = Response as any;
	console.log('✓ Undici polyfill loaded');
}
