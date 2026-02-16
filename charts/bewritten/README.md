# Bewritten Helm Chart

A Helm chart for deploying the Mythos AI Story Architect (Bewritten) application.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (if persistence is enabled)

## Installation

### Install from Git Repository (Direct)

You can install the chart directly from the GitHub repository without cloning it first.

```bash
# Install directly from the main branch
helm install bewritten oci://ghcr.io/bit-bot-bit/charts/bewritten --version 0.1.0
```

*Note: This assumes the chart is published to GHCR as an OCI artifact. If you are installing from the raw Git source:*

```bash
# Install from the raw Git URL (requires helm-git plugin or similar, or just git clone)
git clone https://github.com/bit-bot-bit/bewritten.git
helm install bewritten bewritten/charts/bewritten
```

### Install from Helm Repository (if published)

If the chart is hosted on a Helm repository (e.g., GitHub Pages):

```bash
helm repo add bit-bot-bit https://bit-bot-bit.github.io/bewritten/
helm repo update
helm install bewritten bit-bot-bit/bewritten
```

### Uninstall the chart

```bash
helm uninstall bewritten --namespace default
```

## Configuration

The following table lists the configurable parameters of the Bewritten chart and their default values.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `2` |
| `autoscaling.enabled` | Enable HPA for app pods | `false` |
| `autoscaling.minReplicas` | Minimum app replicas for HPA | `2` |
| `autoscaling.maxReplicas` | Maximum app replicas for HPA | `6` |
| `pdb.enabled` | Enable PodDisruptionBudget | `true` |
| `pdb.minAvailable` | Minimum available app pods during voluntary disruptions | `1` |
| `affinity` | Pod affinity/anti-affinity overrides | `{}` |
| `topologySpreadConstraints` | Topology spread constraints overrides | `[]` |
| `nodeSelector` | Node selector for app pods | `{}` |
| `tolerations` | Tolerations for app pods | `[]` |
| `image.repository` | Image repository | `ghcr.io/bit-bot-bit/bewritten` |
| `image.tag` | Image tag (defaults to chart AppVersion if omitted) | `"0.1.20"` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `service.type` | Kubernetes Service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable Ingress resource | `false` |
| `ingress.hosts[0].host` | Ingress hostname | `chart-example.local` |
| `env.BEWRITTEN_ADMIN_EMAIL` | Admin email address | `admin@example.com` |
| `env.BEWRITTEN_ADMIN_PASSWORD` | Admin password | `ChangeMeNow123!` |
| `env.BEWRITTEN_SECRET_KEY` | App secret key (change in prod!) | `change-this-to-a-secure-random-string` |
| `postgres.enabled` | Deploy bundled PostgreSQL (single instance) | `true` |
| `postgres.auth.username` | Database username | `bewritten` |
| `postgres.auth.password` | Database password | `bewrittenpassword` |
| `postgres.auth.database` | Database name | `bewritten` |
| `postgres.persistence.enabled` | Enable DB persistence | `true` |
| `postgres.persistence.size` | DB Volume size | `1Gi` |

Note: The bundled chart PostgreSQL is a single StatefulSet replica. For full HA in production, use an external HA PostgreSQL service and disable `postgres.enabled`.

To override values during installation:

```bash
helm install bewritten ./bewritten \
  --set env.BEWRITTEN_ADMIN_PASSWORD="MySecurePassword" \
  --set postgresql.auth.password="MyDbPassword"
```
