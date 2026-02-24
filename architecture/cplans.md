# Architecture Complexity & Contingency Plans (C-Plans)

This document aims to evaluate whether our current architectural direction (using an NGINX proxy on Fly.io to route to `sqld` namespaces) is overcomplicated, and explores more efficient or alternative ways to connect Cloudflare Workers to self-hosted multi-tenant Turso databases.

---

## The Core Problem

We have a requirement clash between three technologies:

1.  **Turso/sqld Namespaces**: To keep data localized for the React Native offline-first sync (so users don't download everyone else's data), we _must_ use `sqld` namespaces. `sqld` routes queries to specific namespaces **exclusively by reading the HTTP `Host` header** (e.g., `tenant-123.tar-sqld.fly.dev`).
2.  **Cloudflare Workers**: For security reasons, Cloudflare `fetch()` strictly forbids overriding the `Host` header when calling an external server. If your worker fetches `https://tar-sqld.fly.dev`, the Host header is locked to `tar-sqld.fly.dev` (the `default` namespace).
3.  **Fly.io Routing**: Fly's built-in edge proxy does not allow you to rewrite incoming Host headers right before they hit your app based on custom headers.

---

## Probability & Efficiency Analysis of Alternatives

### Plan A: NGINX Reverse Proxy (Current Selected Route)

- **How it works**: A lightweight NGINX process runs inside the _same_ Docker container as `sqld`. CF Worker sends a custom header `X-Namespace: user-1`. NGINX reads it, rewrites the `Host` header to `user-1...`, and hands it to `sqld` on `localhost:5001`.
- **Complexity**: **Medium**. It requires modifying the `Dockerfile` to use a bash `entrypoint.sh` to run two processes.
- **Efficiency**: **High**. NGINX is written in C and handles requests in <1ms. It shares the same 256MB RAM as `sqld` natively.
- **Cost**: **Free** (₹0 extra).
- **Verdict**: **Best Path.** It feels like a hack, but it is the industry-standard workaround for Cloudflare's strict `fetch` rules.

### Plan B: Single Database + `tenant_id` Column

- **How it works**: Abandon `sqld` namespaces entirely. Put all users into the `default` database and add a `tenant_id` column to every table.
- **Complexity**: **Low**. Zero proxies, standard SQLite setup.
- **Efficiency**: **High** for the backend, but **Disastrous for the frontend** (currently).
- **Why we cannot use this**: The React Native app uses Turso's embedded replica feature to power the offline-first experience. When the app syncs, it currently syncs the _entire database file_ from the server. If we use one single database, every user's phone would attempt to download the data of _every other user_ on the platform. _(Note: Turso has announced "Partial Sync" as an upcoming feature in their React Native bindings roadmap, which would allow syncing only specific rows/pages. However, as of right now, it is not released yet and is listed under "What's Next")._
- **Verdict**: **Rejected.** Breaks the core offline-first security/sync model.

### Plan C: Cloudflare Custom Domain + Wildcard DNS

- **How it works**: We purchase a custom domain (`tar-db.com`), put it on Cloudflare, and point a wildcard DNS (`*.tar-db.com`) to Fly.io. We configure Fly.io to accept wildcard certificates. Then the CF Worker can legitimately run `fetch("https://user-1.tar-db.com")`. Because the URL actually contains the tenant ID, Cloudflare naturally sets the correct `Host` header.
- **Complexity**: **High**. Requires managing external DNS, paying for Fly.io wildcard TLS certificates ($1/mo per cert usually), and complex domain mapping.
- **Cost**: Time cost + potential TLS cert costs.
- **Verdict**: **Rejected.** It introduces DNS complexity and potential certificate issues for every new namespace.

### Plan D: Use Managed Turso (Platform as a Service)

- **How it works**: Instead of Fly.io, we just pay Turso for their managed service. They handle the Cloudflare routing automatically.
- **Complexity**: **Lowest**.
- **Cost**: **High**. We only get 500 databases for free. To support 10,000+ driver/merchant streams, we would need to pay Turso's $29/mo (₹2,400) scaler tier plus usage costs.
- **Verdict**: **Rejected.** Defeats our goal of extreme cost-efficiency (a single $3.50 Fly.io server can hold unlimited namespaces until the disk is full).

---

## Conclusion

**We are going in the right direction.**

While setting up NGINX inside a Docker container alongside `sqld` sounds like we are "overcomplicating" things, it is actually the most robust, cheapest, and highest-performing bridge between Cloudflare's security restrictions and Turso's multi-tenant architecture.

It keeps our monthly backend database cost firmly locked at ₹300/mo ($3.50) while allowing unlimited offline-first user databases. Once the Dockerfile is written and deployed, it requires no maintenance.

We should proceed with the current `productionplan.md` and `implementation_plan.md` NGINX setup.
