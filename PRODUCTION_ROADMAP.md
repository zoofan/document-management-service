# Production Roadmap

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CDN (CloudFront)                               │
│                         Static assets, API caching                          │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                         API Gateway / Load Balancer                         │
│                    Rate limiting, Auth, SSL termination                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   API Pod 1   │       │   API Pod 2   │       │   API Pod N   │
│   (Fastify)   │       │   (Fastify)   │       │   (Fastify)   │
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                │ All read/write requests
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Redis (Read-Through Cache)                         │
│                                                                             │
│   GET doc:123 ──► HIT? ──► Return cached (<1ms)                            │
│                    │                                                        │
│                   MISS ──► Query PostgreSQL ──► Cache result ──► Return    │
│                                                                             │
│   WRITE ──► Update PostgreSQL ──► Invalidate cache key ──► Return          │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  │ Cache miss / Writes
                                  ▼
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
      ┌───────────────┐                       ┌───────────────┐
      │  PostgreSQL   │                       │ Elasticsearch │
      │   (Primary)   │                       │   (Search)    │
      │               │                       │               │
      │  Documents,   │                       │  Full-text    │
      │  metadata,    │                       │  search index │
      │  versions     │                       │  (async sync) │
      └───────┬───────┘                       └───────────────┘
              │
              │ Large content (>1MB)
              ▼
      ┌───────────────┐
      │   S3 / Blob   │
      │  (Documents)  │
      └───────────────┘
```

### Data Flow Explanation

**Reads (90% of traffic):**
1. API receives `GET /documents/:id`
2. Check Redis for `doc:{id}` → **Cache HIT**: return in <1ms
3. **Cache MISS**: Query PostgreSQL (~10ms), store in Redis with 5-min TTL, return

**Writes (10% of traffic):**
1. API receives `POST /documents/:id/changes`
2. Validate ETag, apply changes to PostgreSQL
3. **Invalidate** Redis key `doc:{id}` (don't update—simpler, avoids race conditions)
4. Next read will repopulate cache

**Search:**
1. API receives `POST /search`
2. Query Elasticsearch directly (not cached—results change frequently)
3. Elasticsearch syncs from PostgreSQL via Change Data Capture (CDC) or polling

### Redis Cache Keys

| Key | Value | TTL | Invalidated On |
|-----|-------|-----|----------------|
| `doc:{id}` | Full document JSON | 5 min | PATCH, DELETE, changes |
| `doc:{id}:etag` | ETag string | 5 min | Any write |
| `list:page:{n}` | Document list | 30 sec | Create, delete |

**Why Redis?** Reduces PostgreSQL load by 10x, p50 latency <1ms vs ~10ms. Cost: ~$150/mo.

---

## Component Trade-offs

| Component | Prototype | Production | Trade-off |
|-----------|-----------|------------|-----------|
| **Storage** | In-memory Map | PostgreSQL + S3 | Durability vs latency (+5ms) |
| **Search** | Custom index | Elasticsearch | Features vs operational cost |
| **Cache** | None | Redis | Memory cost vs read latency (10x faster) |
| **Compute** | Single process | K8s pods | Complexity vs scalability |

---

## CI/CD Pipeline

```
┌────────┐    ┌────────┐    ┌────────┐    ┌─────────┐    ┌────────┐
│  Push  │───▶│  Lint  │───▶│  Test  │───▶│  Build  │───▶│ Deploy │
└────────┘    │ + Type │    │ + Perf │    │  Image  │    │Canary5%│
              └────────┘    └────────┘    └─────────┘    └───┬────┘
                                                             │
                                          ┌──────────────────┼──────────────────┐
                                          ▼                  ▼                  ▼
                                    ┌──────────┐      ┌──────────┐      ┌──────────┐
                                    │  Monitor │      │ Roll 50% │      │ Roll 100%│
                                    │  15 min  │─────▶│  30 min  │─────▶│ Complete │
                                    └──────────┘      └──────────┘      └──────────┘
                                          │
                                          ▼ (error rate > 1%)
                                    ┌──────────┐
                                    │ Rollback │
                                    └──────────┘
```

**Key decisions:**
- **Canary deploys** over blue/green (gradual risk, less infra)
- **Automated rollback** on error rate spike
- **Feature flags** for risky changes (LaunchDarkly/Unleash)

---

## Security & Compliance

```
┌─────────────────────────────────────────────────────────────────┐
│                        Security Layers                          │
├─────────────────────────────────────────────────────────────────┤
│  Network    │ WAF, DDoS protection, VPC isolation              │
│  Transport  │ TLS 1.3, mTLS between services                   │
│  Auth       │ OAuth2/OIDC (Okta/Auth0), JWT with short TTL     │
│  Data       │ AES-256 at rest, field-level encryption (PII)    │
│  Audit      │ Immutable logs → S3 + Athena (7yr retention)     │
└─────────────────────────────────────────────────────────────────┘
```

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **GDPR** | Soft delete, export API, consent tracking | P0 |
| **SOC2** | Audit logs, access reviews, encryption | P0 |
| **RBAC** | Document-level permissions, org isolation | P1 |

---

## Scalability & Resilience

```
                    ┌─────────────┐
                    │ Normal Load │
                    │   3 pods    │
                    └──────┬──────┘
                           │ CPU > 70%
                    ┌──────▼──────┐
                    │  Scale Out  │
                    │  3 → 10     │
                    └──────┬──────┘
                           │ CPU < 30%
                    ┌──────▼──────┐
                    │  Scale In   │
                    │  10 → 3     │
                    └─────────────┘
```

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| **HPA** | CPU/memory scaling | K8s HorizontalPodAutoscaler |
| **Circuit breaker** | DB/ES failures | Resilience4j or custom |
| **Retry + backoff** | Transient errors | Exponential with jitter |
| **Bulkhead** | Isolate heavy ops | Separate queues for bulk changes |
| **Read replicas** | Read scaling | PostgreSQL streaming replication |

**SLOs:** 99.9% availability, p99 < 200ms, error rate < 0.1%

---

## Monitoring & Observability

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Metrics   │     │    Logs     │     │   Traces    │
│ Prometheus  │     │    Loki     │     │   Jaeger    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                    ┌─────────────┐
                    │   Grafana   │
                    │ Dashboards  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Alerts    │
                    │ PagerDuty   │
                    └─────────────┘
```

**Key metrics:**
- `http_request_duration_seconds` (latency)
- `document_changes_total` (business)
- `search_latency_seconds` (perf)
- `error_rate` (reliability)

**Alerts:** Error rate > 1%, p99 > 500ms, pod restarts > 3/hour

---

## Operations & Cost

| Resource | Dev | Prod | Monthly Est. |
|----------|-----|------|--------------|
| **Compute** | 1 pod | 3-10 pods | $200-600 |
| **PostgreSQL** | db.t3.micro | db.r6g.large + replica | $400 |
| **Elasticsearch** | None | 3-node cluster | $500 |
| **Redis** | None | cache.r6g.large | $150 |
| **S3** | - | Standard + lifecycle | $50 |
| **Total** | ~$50 | **~$1,300-1,700** | |

**Cost controls:**
- S3 lifecycle: Standard → IA (30d) → Glacier (90d)
- Reserved instances for predictable workloads (40% savings)
- Spot instances for batch processing
- Right-size based on actual usage after 30 days

---

## Migration Priority

```
Phase 1 (Week 1-2)        Phase 2 (Week 3-4)        Phase 3 (Week 5-6)
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ ✓ PostgreSQL     │      │ ✓ Elasticsearch  │      │ ✓ Multi-region   │
│ ✓ Basic auth     │      │ ✓ Redis cache    │      │ ✓ Advanced RBAC  │
│ ✓ CI/CD pipeline │      │ ✓ Monitoring     │      │ ✓ Audit logging  │
│ ✓ Docker/K8s     │      │ ✓ Auto-scaling   │      │ ✓ DR testing     │
└──────────────────┘      └──────────────────┘      └──────────────────┘
        │                         │                         │
        ▼                         ▼                         ▼
   MVP Launch              Production Ready            Enterprise Ready
```

---

## Key Trade-off Decisions

1. **PostgreSQL over DynamoDB**: Better for complex queries, ACID transactions; accept higher ops overhead
2. **Elasticsearch over custom index**: 10x dev time savings; accept $500/mo cost
3. **Kubernetes over ECS**: Portability, ecosystem; accept learning curve
4. **Canary over blue/green**: Less infra cost; accept slower rollouts
5. **Managed services over self-hosted**: Higher cost; lower ops burden (worth it for small team)
