# Bewritten Helm Chart

A Helm chart for deploying the Mythos AI Story Architect (Bewritten) application.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (if persistence is enabled)

## Installation

### Add the repository

```bash
# Clone the repository
git clone https://github.com/bit-bot-bit/bewritten.git
cd bewritten/charts
```

### Install the chart

```bash
helm install bewritten ./bewritten --namespace default
```

### Upgrade the chart

```bash
helm upgrade bewritten ./bewritten --namespace default
```

### Uninstall the chart

```bash
helm uninstall bewritten --namespace default
```

## Configuration

The following table lists the configurable parameters of the Bewritten chart and their default values.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Image repository | `ghcr.io/bit-bot-bit/bewritten` |
| `image.tag` | Image tag (defaults to chart AppVersion) | `""` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `service.type` | Kubernetes Service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable Ingress resource | `false` |
| `ingress.hosts[0].host` | Ingress hostname | `chart-example.local` |
| `env.BEWRITTEN_ADMIN_EMAIL` | Admin email address | `admin@example.com` |
| `env.BEWRITTEN_ADMIN_PASSWORD` | Admin password | `ChangeMeNow123!` |
| `env.BEWRITTEN_SECRET_KEY` | App secret key (change in prod!) | `change-this-to-a-secure-random-string` |
| `postgresql.enabled` | Deploy PostgreSQL dependency | `true` |
| `postgresql.auth.username` | Database username | `bewritten` |
| `postgresql.auth.password` | Database password | `bewrittenpassword` |
| `postgresql.auth.database` | Database name | `bewritten` |
| `postgresql.primary.persistence.enabled` | Enable DB persistence | `true` |
| `postgresql.primary.persistence.size` | DB Volume size | `1Gi` |

To override values during installation:

```bash
helm install bewritten ./bewritten \
  --set env.BEWRITTEN_ADMIN_PASSWORD="MySecurePassword" \
  --set postgresql.auth.password="MyDbPassword"
```
