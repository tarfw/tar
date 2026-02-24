# LibSQL Server (sqld) — Deployment Plan

Self-hosted LibSQL server on Fly.io for multi-tenant data sync.

---

## Why Self-Hosted

| Factor           | Turso Managed       | Self-Hosted sqld |
| :--------------- | :------------------ | :--------------- |
| Writes           | ₹ per million rows  | Unlimited        |
| Storage          | ₹ per GB            | Flat VPS cost    |
| Sync             | ₹ per row synced    | Unlimited        |
| Namespaces       | 500 free, then paid | Unlimited        |
| **Monthly cost** | Scales with users   | **Fixed ~₹300**  |

---

## Architecture

```
┌─────────────┐     Turso Sync SDK     ┌────────────────────────────┐
│  Phone App  │ ──────────────────────→ │  sqld on Fly.io            │
│  (SQLite)   │     syncUrl + JWT       │  ┌──────────────────────┐  │
└─────────────┘                         │  │ tenant-111/          │  │
                                        │  │   nodes, points,     │  │
┌─────────────┐     @libsql/client/web  │  │   events             │  │
│  CF Worker  │ ──────────────────────→ │  ├──────────────────────┤  │
│  (tar-api)  │                         │  │ tenant-222/          │  │
└─────────────┘                         │  │   nodes, points,     │  │
                                        │  │   events             │  │
                                        │  ├──────────────────────┤  │
                                        │  │ streams/             │  │
                                        │  │   events (shared)    │  │
                                        │  └──────────────────────┘  │
                                        │  /var/lib/sqld (volume)    │
                                        └────────────────────────────┘
```

---

## Setup Steps

### 1. Generate Ed25519 JWT Keys

```bash
# Private key (CF Worker uses to SIGN tokens — keep secret)
openssl genpkey -algorithm Ed25519 -out libsql.pem

# Public key (sqld uses to VERIFY tokens)
openssl pkey -in libsql.pem -pubout -out libsql.pub
```

### 2. Deploy sqld on Fly.io

```bash
cd tar-sqld
fly launch --no-deploy
fly volumes create sqld_data --size 10 --region maa
fly deploy
```

> **CRITICAL FLY.IO FIX:**
> When deploying `ghcr.io/tursodatabase/libsql-server` to Fly.io with a persistent volume, the container will instantly crash with `Permission denied (os error 13)`.
>
> **Why:** Fly.io mounts volumes strictly as `root:root (0755)`. The official Turso Docker image uses a script (`docker-wrapper.sh`) that drops privileges and runs the database daemon as a restricted user (e.g. `sqld`). This restricted user instantly gets locked out of writing to its own volume, causing the crash.
>
> **The Fix:** You MUST force the Dockerfile to run as root by adding `USER root` and a direct `ENTRYPOINT ["sqld"]` rule to bypass the privilege drop:
>
> ```dockerfile
> FROM ghcr.io/tursodatabase/libsql-server:latest
> USER root
> VOLUME /var/lib/sqld
> EXPOSE 8080
> ENTRYPOINT ["sqld"]
> CMD ["--http-listen-addr", "0.0.0.0:8080", "--enable-namespaces", "--no-welcome"]
> ```

### 3. Manage & Query Databases (cURL Cheat Sheet)

**1. Admin API (Port 8443)** — Used for managing namespaces (tenant databases).
Requires the `SQLD_ADMIN_AUTH_TOKEN` set in Fly secrets (`8e330b3f67264ba68a83fbdb34f5514e`).

```bash
# Create a namespace (database)
curl -X POST https://tar-sqld.fly.dev:8443/v1/namespaces/tenant-111/create \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{}"

# Delete a namespace (DANGER!)
curl -X DELETE https://tar-sqld.fly.dev:8443/v1/namespaces/tenant-111 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

> **Note on Listing:** Open-source `sqld` does not have an HTTP endpoint to "list" all namespaces. You should track your tenant sizes and IDs securely in a master database (like the `default` namespace).
```

**2. Data API (Port 8080)** — Used by the CF Worker to run actual SQL.
The Data API runs on the root endpoint `/v2/pipeline`. It uses the `X-Namespace` header to tell NGINX which namespace you are trying to query.
Requires a JWT signed with the `libsql.pem` private key, where the `id` claim matches the namespace name.

```bash
# Execute SQL: Create a Table
curl -X POST https://tar-sqld.fly.dev/v2/pipeline \
  -H "X-Namespace: tenant-111" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "type": "execute",
        "stmt": {
          "sql": "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);",
          "args": []
        }
      }
    ]
  }'

# Execute SQL: Insert Data
curl -X POST https://tar-sqld.fly.dev/v2/pipeline \
  -H "X-Namespace: tenant-111" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "type": "execute",
        "stmt": {
          "sql": "INSERT INTO users (name) VALUES (?), (?);",
          "args": [{"type": "text", "value": "John Doe"}, {"type": "text", "value": "Jane Doe"}]
        }
      }
    ]
  }'

# Execute SQL: Select Data
curl -X POST https://tar-sqld.fly.dev/v2/pipeline \
  -H "X-Namespace: tenant-111" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "type": "execute",
        "stmt": {
          "sql": "SELECT * FROM users;",
          "args": []
        }
      }
    ]
  }'
```

---

## JWT Token

CF Worker signs → sqld verifies. Scoped to one namespace.

```json
{
  "alg": "EdDSA",
  "payload": {
    "id": "tenant-123",
    "a": "rw"
  }
}
```

| Claim | Purpose                         |
| :---- | :------------------------------ |
| `id`  | Namespace this token can access |
| `a`   | Access: `rw` or `ro`            |

> sqld rejects any JWT whose `id` doesn't match the target namespace.

---

## Namespace API

```
POST   /v1/namespaces/{tenant-id}/create   — create namespace
DELETE /v1/namespaces/{tenant-id}           — delete namespace
GET    /v1/namespaces                       — list all
```

---

## Fly.io Spec

| Config  | Value                                        |
| :------ | :------------------------------------------- |
| Image   | `ghcr.io/tursodatabase/libsql-server:latest` |
| Region  | `maa` (Chennai)                              |
| Machine | `shared-cpu-1x` (256 MB)                     |
| Volume  | 10 GB persistent                             |
| Port    | 8080                                         |
| Cost    | ~$3.50/mo (~₹300)                            |

---

## Files

```
tar-sqld/
├── Dockerfile
├── fly.toml
├── libsql.pem      ← private key (DO NOT COMMIT)
├── libsql.pub      ← public key (baked into image)
└── .gitignore
```

---

## sqld Command-Line Flags

### Core Configuration

| Flag                    | Description                                         |
| :---------------------- | :-------------------------------------------------- |
| `--db-path`             | Database directory path (default: `data.sqld`)      |
| `--extensions-path`     | Directory for trusted extensions with `trusted.lst` |
| `--http-listen-addr`    | HTTP API listen address (default: `127.0.0.1:8080`) |
| `--enable-http-console` | Enable web-based HTTP console at `/console`         |
| `--hrana-listen-addr`   | Legacy WebSocket-only Hrana server address          |

### Admin API & Namespaces

| Flag                          | Description                                           |
| :---------------------------- | :---------------------------------------------------- |
| `--admin-listen-addr`         | Admin API listen address (must differ from user API)  |
| `--enable-namespaces`         | Enable multi-tenant namespace feature                 |
| `--disable-default-namespace` | Disable fallback to default namespace                 |
| `--admin-auth-key`            | Auth key for admin API (requires `admin-listen-addr`) |

### Authentication

| Flag                  | Description                                     |
| :-------------------- | :---------------------------------------------- |
| `--auth-jwt-key-file` | JWT decoding key file for Hrana/HTTP APIs       |
| `--http-auth`         | Legacy HTTP basic auth (format: `basic:$PARAM`) |

### gRPC Configuration

| Flag                          | Description                               |
| :---------------------------- | :---------------------------------------- |
| `--grpc-listen-addr`          | Inter-node RPC listen address             |
| `--grpc-tls`                  | Enable TLS for gRPC (requires cert files) |
| `--grpc-cert-file`            | gRPC server certificate file              |
| `--grpc-key-file`             | gRPC server private key file              |
| `--grpc-ca-cert-file`         | gRPC CA certificate file                  |
| `--primary-grpc-url`          | Primary node gRPC URL for replica mode    |
| `--primary-grpc-tls`          | Enable TLS for primary gRPC connection    |
| `--primary-grpc-cert-file`    | Replica certificate for primary           |
| `--primary-grpc-key-file`     | Replica private key for primary           |
| `--primary-grpc-ca-cert-file` | CA certificate for primary                |

### Replication & Backup

| Flag                              | Description                                   |
| :-------------------------------- | :-------------------------------------------- |
| `--enable-bottomless-replication` | Enable S3 bottomless replication              |
| `--migrate-bottomless`            | Enable bottomless to libsql_wal migration     |
| `--sync-from-storage`             | Sync all namespaces with remote on startup    |
| `--sync-conccurency`              | Sync concurrency (default: 8)                 |
| `--max-log-size`                  | Max replication log size in MB (default: 200) |
| `--max-log-duration`              | Max duration before log compaction (seconds)  |
| `--snapshot-exec`                 | Command to execute on snapshot generation     |
| `--snapshot-at-shutdown`          | Enable snapshot at shutdown                   |

### Performance & Limits

| Flag                                | Description                                    |
| :---------------------------------- | :--------------------------------------------- |
| `--soft-heap-limit-mb`              | Soft heap size limit in MiB                    |
| `--hard-heap-limit-mb`              | Hard heap size limit in MiB                    |
| `--max-response-size`               | Max size for a single response (default: 10MB) |
| `--max-total-response-size`         | Max size for all responses (default: 32MB)     |
| `--max-concurrent-connections`      | Max active connections (default: 128)          |
| `--max-concurrent-requests`         | Max concurrent requests (default: 128)         |
| `--disable-intelligent-throttling`  | Disable intelligent throttling logic           |
| `--connection-creation-timeout-sec` | Connection creation timeout                    |

### Operations & Maintenance

| Flag                                | Description                               |
| :---------------------------------- | :---------------------------------------- |
| `--no-welcome`                      | Don't display welcome message             |
| `--idle-shutdown-timeout-s`         | Shutdown after idle timeout (seconds)     |
| `--initial-idle-shutdown-timeout-s` | Initial idle shutdown timeout (seconds)   |
| `--checkpoint-interval-s`           | WAL checkpoint interval (default: 1 hour) |
| `--shutdown-timeout`                | Shutdown timeout duration (default: 30s)  |
| `--force-load-wals`                 | Force loading all WALs at startup         |

### Monitoring & Debugging

| Flag                        | Description                               |
| :-------------------------- | :---------------------------------------- |
| `--heartbeat-url`           | URL for heartbeat POST requests           |
| `--heartbeat-auth`          | Authorization header for heartbeat        |
| `--heartbeat-period-s`      | Heartbeat period in seconds (default: 30) |
| `--enable-deadlock-monitor` | Enable main runtime deadlock monitor      |
| `--disable-metrics`         | Disable Prometheus metrics collection     |

### Storage & Meta Store

| Flag                         | Description                                             |
| :--------------------------- | :------------------------------------------------------ |
| `--max-active-namespaces`    | Max active namespaces in memory (default: 100)          |
| `--backup-meta-store`        | Enable backup for metadata store                        |
| `--meta-store-*`             | Various S3 backup configuration flags                   |
| `--allow-metastore-recovery` | Allow config recovery from filesystem                   |
| `--storage-server-address`   | Storage server address (default: `http://0.0.0.0:5002`) |

### Encryption

| Flag               | Description                           |
| :----------------- | :------------------------------------ |
| `--encryption-key` | Encryption key for encryption at rest |

### URL Configuration

| Flag                 | Description                           |
| :------------------- | :------------------------------------ |
| `--http-self-url`    | URL for sticky sessions in Hrana HTTP |
| `--http-primary-url` | HTTP primary URL                      |

> **Notes:** All flags support environment variables. Some flags have dependencies (e.g. `--grpc-tls` requires cert files). Namespace flags require `--admin-listen-addr`. Bottomless replication requires S3 env vars.

---

_Schema → [schema.md](./schema.md) · Production plan → [productionplan.md](./productionplan.md)_
