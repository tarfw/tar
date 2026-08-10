/**
 * tarsite — Multi-Route Path Matcher (Phase 7)
 * Parameterized router matching exact static routes, dynamic parameter routes (/product/:id),
 * and handling 404 fallbacks cleanly.
 */

import { type UIPlan, type UIRoute } from './types';

export interface RouteMatchResult {
  matched: boolean;
  route?: UIRoute;
  params: Record<string, string>;
}

export function matchPath(pathname: string, plan: UIPlan): RouteMatchResult {
  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  // 1. Try Exact Static Route Match
  const staticMatch = plan.routes.find((r) => r.path === cleanPath);
  if (staticMatch) {
    return { matched: true, route: staticMatch, params: {} };
  }

  // 2. Try Parameterized Route Match (e.g., /product/:id)
  const pathParts = cleanPath.split('/').filter(Boolean);

  for (const route of plan.routes) {
    const routeParts = route.path.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let isMatch = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return { matched: true, route, params };
    }
  }

  // 3. Fallback: Return Homepage (route[0]) if available
  if (plan.routes.length > 0) {
    return { matched: true, route: plan.routes[0], params: {} };
  }

  return { matched: false, params: {} };
}
