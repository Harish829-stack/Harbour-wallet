# Harbour Wallet: Production Hosting Comparison

Prepared: 2 November 2026  
Codebase reviewed: `harbour-wallet-v3`

## What needs to be deployed

Harbour is a Chrome extension backed by a persistent, multi-service backend. The extension is built and distributed separately through the Chrome Web Store; it does not run on the backend host.

| Component | Purpose | Deployment requirement |
| --- | --- | --- |
| Chrome extension | Wallet UI, local key custody, transaction signing | Production build and Chrome Web Store distribution |
| Go API | Device authentication, wallet data, transaction endpoints, third-party gateway | Always-running container |
| RPC gateway | Provider routing, caching, failover | Private, always-running container |
| Indexer | Transaction history, balances, NFTs, chain activity | Background service |
| Webhook receiver | Receives verified provider activity | Public HTTPS endpoint |
| Price poller | Refreshes prices and snapshots | Background service |
| Transaction tracker | Tracks broadcasts through settlement | Background service |
| Realtime bridge | Sends backend events to Centrifugo | Background service |
| Notifier | Delivers supported push notifications | Background service |
| PostgreSQL | Durable wallet application data | Persistent storage and tested recovery |
| Redis | Cache, rate limits, deduplication, realtime support | Private service; persistence as required |
| NATS | Internal event messaging | Private service with configured authentication and persistent storage |
| Centrifugo | Live balance and transaction updates | Public WSS endpoint; private administrative API |
| Migration job | Applies schema changes and maintains partitions | Deployment job plus scheduled partition maintenance |

The existing backend Dockerfile builds the Go binaries; the command selects which service runs. Docker Compose currently wires up the local stack. Production needs its own networking, secrets, storage, restart, monitoring, and recovery configuration.

The current extension configuration can send third-party gateway requests through the Go API at `/v1/gw`. The older Cloudflare Worker is optional for that configuration.

## Pricing assumptions

- Published prices were checked on 2 November 2026. All amounts are USD, before taxes.
- Whole-wallet budgets below are planning estimates for light initial usage, not provider quotes or measured capacity guarantees.
- Budgets exclude blockchain/data API subscriptions, domain registration, store registration, independent security review, and engineering or operational labor.
- Indexing, polling, history backfills, enabled chains, storage growth, and provider traffic can materially change costs.
- A single instance or single server is not a highly available architecture. Production redundancy increases the bill.

## Provider comparison

| Provider | Best suited to | Published entry points | Initial hosting budget estimate | Setup difficulty |
| --- | --- | --- | --- | --- |
| Railway | Small team prioritizing deployment convenience | Hobby: $5 minimum/month; Pro: $20 minimum/month | $60–150/month | Lowest of these options |
| DigitalOcean | Budget-conscious team with someone to operate a server | Basic Droplets: $24, $48, $96/month at 4, 8, 16 GB RAM | $60–120/month | Moderate |
| AWS | Long-term production architecture with operational support | Pay as you go across compute, database, cache, networking, and monitoring | $200–500/month initially; $500–1,000+ with more redundancy | Highest |

These estimates describe different operating models and are not equivalent availability guarantees. None of the entry prices covers the complete wallet stack.

## 1. Railway

### Plans and fees

| Plan | Published minimum | Relevance to Harbour |
| --- | --- | --- |
| Free | $0; limited monthly resources | Development experiments; insufficient for this complete stack |
| Hobby | $5/month, including $5 of resource usage | Personal development and small staging environments |
| Pro | $20/month, including $20 of resource usage | Recommended Railway starting plan for a production deployment |
| Enterprise | Custom | Contractual or organizational requirements |

The minimum counts toward resource usage. A $100 resource bill on Pro is approximately $100 total, not $120. Published service rates are approximately $10/GB-month of RAM, $20/vCPU-month of CPU, and $0.15/GB-month of volume storage, plus $0.05/GB egress; actual billing uses metered units.

Source: [Railway pricing](https://railway.com/pricing).

### How to deploy this codebase

1. Build the backend Docker image from `harbour-wallet-v3/backend`.
2. Create a separate service for each Go binary and set its startup command.
3. Add PostgreSQL, Redis, NATS, and Centrifugo with appropriate persistent volumes and private connectivity.
4. Adapt the existing mounted configuration, certificates, and environment variables to Railway.
5. Run migrations as a controlled deployment step and schedule partition maintenance.
6. Expose only the API, webhook receiver, and Centrifugo client connection endpoint publicly.
7. Configure backups, recovery, alerts, and production provider credentials.

### Advantages

- Convenient service deployments, logs, secrets configuration, and private networking.
- Less operating-system administration than a self-managed virtual machine.
- Services can be deployed and sized independently.
- Good fit for a developer who wants to get an initial environment online with less infrastructure work.

### Disadvantages

- Usage-based costs are less predictable than a fixed server allocation.
- The Compose file must be translated into platform services; this is not a single frontend deployment.
- Persistent services still require explicit backup, restore, upgrade, and availability decisions.
- Hobby storage limits are restrictive for an indexer whose database grows over time.
- Convenience does not prove that the wallet is ready for a public mainnet launch.

### Suggested starting budget

Use Pro and reserve approximately **$100–150/month for hosting** until actual resource usage is measured. Configure spending alerts and review indexing and polling costs early.

## 2. DigitalOcean

### Plans and fees

Published Basic Droplet prices for regular CPU instances:

| RAM | vCPU | SSD | Monthly price |
| --- | --- | --- | --- |
| 4 GB | 2 | 80 GB | $24 |
| 8 GB | 4 | 160 GB | $48 |
| 16 GB | 8 | 320 GB | $96 |

Source: [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets).

Managed PostgreSQL is optional. Published compute starts at **$15.15/month for 1 GB**, **$30.45 for 2 GB**, and **$60.90 for 4 GB**, with storage priced separately. The smallest database is an entry point, not a capacity recommendation for Harbour.

Source: [DigitalOcean managed database pricing](https://www.digitalocean.com/pricing/managed-databases).

### How to deploy this codebase

1. Provision a Linux Droplet; 8 GB RAM and 4 vCPU is a starting configuration to validate under load.
2. Install Docker and adapt the existing Compose stack for production.
3. Add an HTTPS reverse proxy for the API, webhooks, and Centrifugo WebSocket endpoint.
4. Keep databases, messaging, internal RPC, and administrative interfaces private.
5. Add restart policies, health monitoring, patching, backup retention, and restore procedures.
6. Optionally move PostgreSQL to the managed service, after checking migration permissions, extension support, and partition maintenance.

### Advantages

- The closest fit to the existing Docker Compose deployment.
- Predictable baseline compute pricing.
- Full control over database extensions, configuration files, and internal networking.
- An economical initial environment when server operations are already covered.

### Disadvantages

- You are responsible for Linux and Docker updates, deployment automation, certificates, and incident recovery.
- Running everything on one Droplet creates a single point of failure.
- Database backups must be designed and restored in practice; a server snapshot alone does not establish the required database recovery guarantees.
- Scaling and separating services requires additional work.

### Suggested starting budget

Allow **$60–120/month**, depending on backups and whether PostgreSQL is managed. Start from the $48 Droplet only after confirming resource usage; add capacity or split services when measurements justify it.

## 3. AWS

### Plans and fees

AWS does not have one subscription that includes this entire stack. Services are billed separately under pay-as-you-go pricing, with optional commitments such as Savings Plans for eligible compute usage.

| Component | Suggested AWS service | Billing considerations |
| --- | --- | --- |
| Go services and Centrifugo | ECS Fargate | Allocated CPU, memory, running time, and other applicable resources |
| PostgreSQL | RDS PostgreSQL | Instance capacity, storage, I/O where applicable, backups, and failover configuration |
| Redis-compatible cache | ElastiCache | Selected deployment mode and capacity |
| NATS | Dedicated persistent EC2 deployment or external managed NATS | Compute, durable storage, operations, and replication |
| HTTPS and WebSockets | Application Load Balancer | Hourly charge and usage-based capacity charges |
| Secrets | Secrets Manager | Stored secrets and API usage |
| Logs and metrics | CloudWatch | Ingestion, retention, alarms, and other selected features |
| Container images | ECR | Storage and applicable transfer |
| Networking | VPC and related resources | NAT, public IPv4, and data transfer where applicable |

For reference, a continuously running Linux/x86 Fargate task with **0.25 vCPU and 0.5 GB RAM** is about **$9/month** for CPU and memory at US East (N. Virginia) pricing. Ten such tasks are roughly $90/month before database, cache, networking, monitoring, and redundancy. This is an illustrative calculation, not a sizing recommendation. Region prices differ.

Sources: [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/), [load balancer pricing](https://aws.amazon.com/elasticloadbalancing/pricing/), [AWS Pricing Calculator](https://calculator.aws/).

### How to deploy this codebase

1. Build the backend image and publish it to ECR.
2. Create ECS services and a migration task with service-specific secrets and permissions.
3. Provision RDS PostgreSQL and ElastiCache in private networking.
4. Deploy NATS with a deliberate persistence and recovery design. Amazon MQ is not a direct replacement for NATS.
5. Configure load-balancer routes, certificates, webhook URLs, and the Centrifugo WSS endpoint.
6. Add monitoring, deployment rollback, database recovery, and operational runbooks.
7. Load-test the selected service sizes and validate provider failover and recovery.

### Advantages

- Matches the AWS architecture already proposed in the repository's backend plan.
- Extensive options for database recovery, failover, service isolation, access control, and scaling.
- Can separate database, application, and messaging failure domains as the deployment grows.
- A strong fit for a team operating a wallet over the long term.

### Disadvantages

- Highest setup and ongoing operational complexity of these three options.
- Networking, logs, backups, and load balancing can materially increase the bill.
- NATS still needs a suitable deployment and operating model.
- Strong capabilities only help when configured and tested correctly.

### Suggested starting budget

Reserve **$200–500/month** for an initial managed deployment and **$500–1,000+** when adding more redundancy. Produce a region-specific estimate before provisioning; these budgets do not guarantee a particular user count or recovery target.

## Costs outside the hosting provider

| Item | What to account for |
| --- | --- |
| RPC and indexing | Alchemy, Infura, Helius, and other enabled chain providers; history backfills and polling can be significant |
| Price data | CoinGecko or other configured sources; choose a plan that covers the intended usage |
| Swaps, ramps, and other integrations | Required production credentials, supported regions, partner onboarding, and transaction-related charges |
| WalletConnect | Reown project configuration and applicable plan limits |
| Domain | Annual registration and any paid DNS services selected |
| Chrome Web Store | Developer registration, listing preparation, and review |
| Operations | Monitoring, backups, security review, and someone responsible for incidents |

As one current reference, Alchemy offers **30 million compute units/month on Free** and **Pay As You Go at $0.525 per million compute units**. Compute units are not equivalent to one request each. Validate which endpoints and throughput your selected plan covers.

Sources: [Alchemy pricing](https://www.alchemy.com/pricing), [Chrome Web Store registration](https://developer.chrome.com/docs/webstore/register/).

## Requirements for a fully working production deployment

1. Deploy all required services and run migrations successfully.
2. Configure stable public HTTPS API and webhook URLs, plus WSS for realtime connections.
3. Set `APP_ENV=production`, trusted proxy configuration, production secrets, and external service credentials.
4. Keep database, Redis, NATS, internal RPC, and administrative endpoints private.
5. Enable the intended chains and verify each feature's provider support and quotas.
6. Rebuild the extension with `VITE_HB_API_URL=https://api.yourdomain.com` and other public production settings. Provider secrets stay on the backend.
7. Generate and verify the release package using the repository's release process.
8. Exercise balances, history, NFTs, sends, swaps, realtime events, notifications, and device registration against the deployed backend.
9. Validate backup restoration, deployment rollback, and recovery after service or provider failure.
10. Reconcile the repository's production-readiness findings with the current implementation before a public mainnet launch, then publish the extension.

Deploying the infrastructure establishes hosting; it does not establish security or public-launch readiness. The existing readiness report records validation work that must be checked against the current code.

## Final recommendation: the best overall choice across scenarios

**AWS is my strongest overall recommendation for Harbour's long-term public production deployment, provided that someone can build and operate it properly. Railway Pro remains my recommendation for your easiest first hosted environment.**

There is no provider that wins every scenario. The distinction is between the easiest first deployment and the most flexible long-term production foundation:

| Scenario | Recommended choice | Why |
| --- | --- | --- |
| First hosted environment; limited infrastructure experience | Railway Pro | Reduces initial deployment and server-management work |
| Lowest predictable hosting budget; server operator available | DigitalOcean | Uses the existing Compose approach with a fixed server baseline |
| Public wallet intended to grow; operational support available | AWS | Fits the existing architecture and offers more recovery, isolation, and scaling options |
| Stronger failover or recovery requirements | AWS with an explicitly designed redundant deployment | Supports separating failures and implementing managed database recovery; results still require testing |
| Private beta or small validation rollout | Railway Pro | Lets the team validate the product before taking on a larger infrastructure setup |

### Why AWS wins the broader long-term comparison

1. **It matches your codebase's existing plan.** The documented backend architecture already targets ECS Fargate, RDS PostgreSQL, and ElastiCache.
2. **It supports the actual workload.** Harbour needs continuously running workers, persistent data, internal messaging, public webhooks, and realtime connections.
3. **It provides more recovery and availability choices.** Database failover, backups, service replicas, and isolated networking can be designed around concrete recovery targets.
4. **It gives room to grow without immediately changing providers.** Individual parts can be resized, replicated, or separated as measured demand changes.

**For your current situation, start with Railway Pro if simplicity is the priority. If you can fund operational support and want to follow the repository's intended production architecture from day one, choose AWS directly.** Moving later is feasible, but requires database migration, secret and certificate changes, endpoint cutover, and recovery testing; it is not automatic.
