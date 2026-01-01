# Divine Heroes - Production Deployment Guide

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   CDN / Edge    │
                                    │   (CloudFlare)  │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Ingress/ALB    │
                                    │  (Rate Limiting)│
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │   API Service   │     │ Battle Service  │     │  Gacha Service  │
           │   (2-10 pods)   │     │   (2-8 pods)    │     │   (2-6 pods)    │
           │     HPA: 70%    │     │    HPA: 60%     │     │    HPA: 60%     │
           └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐
           │     Redis       │     │    MongoDB      │
           │  (Cache + MQ)   │     │   (Database)    │
           └─────────────────┘     └─────────────────┘
```

## Quick Start

### Option 1: Docker Compose (Development/Small Scale)

```bash
cd deploy/docker
docker-compose up -d
```

This starts:
- Main API on port 8001
- Battle Service on port 8002 (2 replicas)
- Gacha Service on port 8003 (2 replicas)
- MongoDB on port 27017
- Redis on port 6379
- Nginx load balancer on port 80

### Option 2: Kubernetes (Production)

```bash
# Apply all manifests in order
kubectl apply -f deploy/kubernetes/

# Or apply individually
kubectl apply -f deploy/kubernetes/00-namespace.yaml
kubectl apply -f deploy/kubernetes/01-configmap.yaml
kubectl apply -f deploy/kubernetes/02-api-deployment.yaml
kubectl apply -f deploy/kubernetes/03-battle-deployment.yaml
kubectl apply -f deploy/kubernetes/04-gacha-deployment.yaml
kubectl apply -f deploy/kubernetes/05-redis-deployment.yaml
kubectl apply -f deploy/kubernetes/06-mongodb-deployment.yaml
kubectl apply -f deploy/kubernetes/07-ingress.yaml
kubectl apply -f deploy/kubernetes/08-pdb.yaml
kubectl apply -f deploy/kubernetes/09-network-policies.yaml
kubectl apply -f deploy/kubernetes/10-monitoring.yaml
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_ENABLED` | Enable Redis cache | `false` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `MQ_BACKEND` | Message queue backend (memory/redis/rabbitmq/kafka) | `memory` |
| `RATE_LIMIT_REQUESTS` | Requests per window | `120` |
| `RATE_LIMIT_WINDOW` | Window size in seconds | `60` |
| `CACHE_TTL_SHORT` | Short cache TTL | `30` |
| `CACHE_TTL_MEDIUM` | Medium cache TTL | `60` |
| `CACHE_TTL_LONG` | Long cache TTL | `300` |
| `METRICS_ENABLED` | Enable Prometheus metrics | `false` |

### Scaling Configuration

#### Horizontal Pod Autoscaler (HPA)

| Service | Min Replicas | Max Replicas | CPU Target |
|---------|--------------|--------------|------------|
| API | 2 | 10 | 70% |
| Battle | 2 | 8 | 60% |
| Gacha | 2 | 6 | 60% |

#### Resource Limits

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|-------------|-----------|----------------|--------------|
| API | 250m | 1000m | 256Mi | 512Mi |
| Battle | 200m | 500m | 128Mi | 256Mi |
| Gacha | 200m | 500m | 128Mi | 256Mi |

## Monitoring

### Health Endpoints

- **Liveness**: `GET /health/live` - Is the service running?
- **Readiness**: `GET /health/ready` - Can the service handle requests?
- **Metrics**: `GET /metrics` - JSON metrics
- **Prometheus**: `GET /metrics/prometheus` - Prometheus format

### Key Metrics to Monitor

1. **Request Rate**: `divine_heroes_request_success`
2. **Response Time**: `divine_heroes_request_duration_ms`
3. **Cache Hit Rate**: `divine_heroes_cache_hit / (hit + miss)`
4. **Rate Limits**: `divine_heroes_rate_limit_exceeded`
5. **Error Rate**: `divine_heroes_request_error`

### Grafana Dashboard

Import the dashboard from `deploy/kubernetes/10-monitoring.yaml`

## Scaling Guide

### When to Scale

| Symptom | Solution |
|---------|----------|
| API latency > 200ms | Scale API replicas |
| Battle queue buildup | Scale Battle service |
| Gacha timeout errors | Scale Gacha service |
| Cache miss rate > 50% | Increase Redis memory |
| DB connections maxed | Add read replicas |

### Manual Scaling

```bash
# Scale API to 5 replicas
kubectl scale deployment api-deployment --replicas=5 -n divine-heroes

# Check HPA status
kubectl get hpa -n divine-heroes
```

### Auto-scaling Events

The HPA will automatically:
- Scale UP when CPU > 70% (API) or 60% (services)
- Scale DOWN after 5 minutes of low utilization
- Respect PodDisruptionBudgets during rolling updates

## High Availability

### Pod Distribution

Pods are distributed across nodes using anti-affinity rules to ensure:
- No single node failure takes down all replicas
- Even distribution across availability zones

### Database Resilience

- MongoDB uses StatefulSet with persistent volumes
- Redis uses AOF persistence for durability

### Network Policies

- Services can only communicate with required dependencies
- External access only through Ingress

## Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod <pod-name> -n divine-heroes
   kubectl logs <pod-name> -n divine-heroes
   ```

2. **HPA not scaling**
   ```bash
   kubectl describe hpa api-hpa -n divine-heroes
   # Check if metrics-server is running
   kubectl top pods -n divine-heroes
   ```

3. **Cache not working**
   ```bash
   # Check Redis connection
   kubectl exec -it redis-deployment-xxx -n divine-heroes -- redis-cli ping
   ```

4. **High latency**
   ```bash
   # Check cache stats
   curl http://api-service:8001/metrics | grep cache
   ```

## Production Checklist

- [ ] Update secrets with production values
- [ ] Configure TLS certificates
- [ ] Set up monitoring alerts
- [ ] Configure backup strategy for MongoDB
- [ ] Enable Redis persistence
- [ ] Set up CI/CD pipeline for deployments
- [ ] Configure CDN for static assets
- [ ] Set up log aggregation (ELK/Loki)
- [ ] Configure distributed tracing (Jaeger)
- [ ] Load test before launch
