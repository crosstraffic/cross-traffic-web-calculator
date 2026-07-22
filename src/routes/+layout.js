import { redirect } from '@sveltejs/kit';

// Only these HCM chapter pages are released. Every other /hcmNN route still
// exists in the repo but is not exposed publicly yet — a direct visit (or any
// navigation) is redirected to the home page. Runs on both the server (typed
// URL / bookmark) and the client. Add a route here to release it.
const RELEASED = new Set(['/hcm12', '/hcm15']);

export function load({ url }) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (/^\/hcm[0-9a-z]+$/i.test(path) && !RELEASED.has(path)) {
    throw redirect(307, '/');
  }
  return {};
}
