/**
 * tarsite — Server Resource Resolver & Data Binder (Phase 6)
 * Walks active UIPlan routing node tree on incoming request, queries dynamic data,
 * and binds dynamic data into component props deterministically.
 */

import { type UIPlan, type UINode, type UIRoute } from './types';

export interface ResolverContext {
  env: any;
  workspaceSlug: string;
}

export async function resolveRouteData(route: UIRoute, ctx: ResolverContext): Promise<UIRoute> {
  const resolvedNodes: UINode[] = [];

  for (const node of route.nodes) {
    const resolvedNode = { ...node, props: { ...node.props } };

    // Resolve resource bindings if present
    if (node.bindings) {
      for (const [propKey, binding] of Object.entries(node.bindings)) {
        try {
          if (binding.resource === 'matter.product') {
            // Try fetching real items from environment database if available
            if (ctx.env?.DB) {
              const res = await ctx.env.DB.prepare(
                'SELECT data FROM matter WHERE scope = ? AND type = ? AND active = 1 LIMIT 20'
              )
                .bind(`w:${ctx.workspaceSlug}`, 'product')
                .all();
              if (res?.results && res.results.length > 0) {
                resolvedNode.props[propKey] = res.results.map((r: any) => {
                  try { return JSON.parse(r.data); } catch { return { name: 'Item', price: 0 }; }
                });
              }
            }
          }
        } catch (err) {
          console.warn(`[resolver] Dynamic resource resolve warning (${binding.resource}):`, err);
        }
      }
    }

    if (node.children) {
      const childRoute: UIRoute = { id: 'temp', path: 'temp', nodes: node.children };
      const resolvedChild = await resolveRouteData(childRoute, ctx);
      resolvedNode.children = resolvedChild.nodes;
    }

    resolvedNodes.push(resolvedNode);
  }

  return { ...route, nodes: resolvedNodes };
}
