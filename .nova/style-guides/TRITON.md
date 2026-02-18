# TRITON - CI/CD & Deployment Style Guide

## CI/CD Workflow Naming

### Workflow File Naming
```
[action]-[target]-[trigger].yml

Examples:
- test-pull-request.yml
- deploy-staging.yml
- deploy-production.yml
- release-version.yml
- security-scan.yml
- dependency-update.yml
```

### Workflow Name Standards
```yaml
# Format: [Action]: [Target] ([Trigger])
name: Test: Pull Request
name: Deploy: Staging (Manual)
name: Deploy: Production (Release)
name: Scan: Security (Scheduled)
```

### Job Naming
```yaml
jobs:
  # Format: [verb]-[noun]
  lint-code:
  run-unit-tests:
  run-integration-tests:
  build-image:
  deploy-to-staging:
  run-smoke-tests:
  notify-slack:
```

### Step Naming
```yaml
steps:
  # Use imperative mood, be specific
  - name: Checkout repository
  - name: Setup Node.js 20
  - name: Install dependencies
  - name: Run linter
  - name: Build application
  - name: Upload artifacts
```

## Deployment Script Conventions

### Script File Naming
```
[action]-[environment]-[component].sh

Examples:
- deploy-production-api.sh
- rollback-staging-database.sh
- setup-development-env.sh
- verify-deployment-health.sh
```

### Script Structure Template
```bash
#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: [Action] [Target]
# Description: [What this script does]
# Usage: ./script-name.sh [options]
# =============================================================================

# --- Configuration ------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ENVIRONMENT="${ENVIRONMENT:-staging}"
readonly VERSION="${VERSION:-latest}"

# --- Colors for output --------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# --- Logging ------------------------------------------------------------------
log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- Functions ----------------------------------------------------------------
check_prerequisites() {
    log_info "Checking prerequisites..."
    # Implementation
}

deploy() {
    log_info "Starting deployment..."
    # Implementation
}

verify() {
    log_info "Verifying deployment..."
    # Implementation
}

# --- Main ---------------------------------------------------------------------
main() {
    check_prerequisites
    deploy
    verify
    log_info "Deployment complete!"
}

main "$@"
```

### Pre-deployment Checks
```bash
pre_deploy_checks() {
    log_info "Running pre-deployment checks..."
    
    # Required environment variables
    : "${DATABASE_URL:?DATABASE_URL is required}"
    : "${API_KEY:?API_KEY is required}"
    
    # Version compatibility
    check_version_compatibility "$VERSION"
    
    # Database migrations ready
    verify_migrations_status
    
    # Health of existing deployment
    if deployment_exists; then
        check_current_health
    fi
    
    # Quota/Resource availability
    check_resource_quotas
}
```

### Deployment Patterns
```bash
# Blue-Green Deployment
deploy_blue_green() {
    local new_color="${CURRENT_COLOR:-blue}"
    local old_color="$([ "$new_color" = "blue" ] && echo "green" || echo "blue")"
    
    deploy_to_color "$new_color"
    verify_health "$new_color"
    switch_traffic "$new_color"
    drain_connections "$old_color"
}

# Rolling Deployment  
deploy_rolling() {
    local batches=($(get_instance_batches))
    
    for batch in "${batches[@]}"; do
        log_info "Deploying batch: $batch"
        deploy_batch "$batch"
        verify_batch_health "$batch"
        wait_for_stability
    done
}

# Canary Deployment
deploy_canary() {
    deploy_canary_version 5     # 5% traffic
    verify_canary_metrics 300   # 5 min observation
    
    deploy_canary_version 25    # 25% traffic
    verify_canary_metrics 600   # 10 min observation
    
    deploy_canary_version 100   # Full rollout
}
```

## Environment Config Standards

### Environment Naming
```
Production:    prod, production
Staging:       staging, stage
Development:   dev, development
Local:         local, localhost
Testing:       test, ci, qa
```

### Configuration File Structure
```
config/
├── default.yml           # Base configuration
├── production.yml        # Production overrides
├── staging.yml           # Staging overrides
├── development.yml       # Development overrides
├── test.yml              # Test overrides
└── local.yml             # Local overrides (gitignored)
```

### Environment Variable Naming
```bash
# Format: [SERVICE]_[COMPONENT]_[PROPERTY]

# Database
DATABASE_URL
DATABASE_POOL_SIZE
DATABASE_TIMEOUT_MS

# API
API_BASE_URL
API_TIMEOUT_MS
API_RETRY_ATTEMPTS

# Cache
REDIS_URL
REDIS_POOL_SIZE
CACHE_TTL_SECONDS

# Feature Flags
FEATURE_NEW_UI_ENABLED
FEATURE_BETA_API_ENABLED
```

### Secret Management
```yaml
# Use secret references, never hardcoded values
# Format: ${SECRET_NAME}

database:
  password: ${DB_PASSWORD}  # From secret manager
  
api:
  key: ${API_KEY}           # From secret manager
  
auth:
  jwt_secret: ${JWT_SECRET} # From secret manager
```

### Environment Validation
```bash
validate_environment() {
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "API_SECRET"
        "ENVIRONMENT"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required variable $var is not set"
            exit 1
        fi
    done
    
    # Validate environment value
    case "$ENVIRONMENT" in
        production|staging|development|test) ;;
        *) log_error "Invalid ENVIRONMENT: $ENVIRONMENT"; exit 1 ;;
    esac
}
```

## Release Process Template

### Release Branch Naming
```
release/v[MAJOR].[MINOR].[PATCH]

Examples:
- release/v1.2.0
- release/v2.0.0-rc.1
- release/v1.1.1-hotfix
```

### Release Checklist
```markdown
## Release Checklist: v[X.Y.Z]

### Pre-Release
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Release notes drafted
- [ ] QA sign-off obtained
- [ ] Database migrations reviewed
- [ ] Feature flags configured for prod

### Deployment
- [ ] Staging deployment verified
- [ ] Production deployment window scheduled
- [ ] Rollback plan documented
- [ ] Monitoring dashboards checked
- [ ] On-call engineer notified

### Post-Release
- [ ] Smoke tests passed
- [ ] Error rates normal
- [ ] Performance metrics stable
- [ ] Customer-facing announcements sent
- [ ] Release tagged in git
- [ ] Release notes published
```

### Release Workflow
```yaml
name: Release: Production

on:
  release:
    types: [published]

env:
  VERSION: ${{ github.event.release.tag_name }}

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate release notes
      - name: Check version consistency

  build:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker image
      - name: Run security scan
      - name: Push to registry

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
      - name: Run integration tests

  deploy-production:
    needs: deploy-staging
    environment: production  # Requires manual approval
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
      - name: Verify health checks
      - name: Notify team
```

### Version Tagging
```bash
# Semantic Versioning
# MAJOR.MINOR.PATCH[-prerelease][+build]

# Standard release
git tag -a v1.2.0 -m "Release version 1.2.0"

# Pre-release
git tag -a v2.0.0-beta.1 -m "Beta release 2.0.0-beta.1"

# Hotfix
git tag -a v1.2.1 -m "Hotfix: resolve critical bug"

# Push tags
git push origin --tags
```
