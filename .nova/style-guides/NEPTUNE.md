# NEPTUNE - Metrics & Analytics Style Guide

## Metric Naming Conventions

### Format
```
[domain].[entity].[action].[unit]
```

### Components
| Component | Values | Example |
|-----------|--------|---------|
| `domain` | api, db, cache, queue, worker, system | `api` |
| `entity` | resource being measured | `user`, `order`, `request` |
| `action` | operation type | `created`, `duration`, `count` |
| `unit` | measurement unit | `ms`, `bytes`, `total` |

### Standard Metrics
```typescript
// Latency metrics (timing)
api.request.duration.ms          // Response time
db.query.duration.ms             // Query execution time
cache.lookup.duration.ms         // Cache hit/miss lookup

// Counter metrics (throughput)
api.request.count                // Total requests
db.query.count                   // Total queries
queue.message.processed          // Messages processed

// Gauge metrics (current state)
system.memory.used.bytes         // Current memory usage
db.connections.active            // Active connections
queue.size                       // Queue depth

// Error metrics
api.error.count                  // Total errors
api.error.rate                   // Error percentage
db.query.failed.count            // Failed queries
```

### Labels/Dimensions
```typescript
// Standard labels
{
  environment: 'prod' | 'staging' | 'dev',
  service: string,              // service name
  method: 'GET' | 'POST' | ...,
  endpoint: string,             // /api/v1/users
  status: '200' | '404' | '500',
  error_type: 'timeout' | 'validation' | 'server',
  cache_result: 'hit' | 'miss',
}

// Example
api.request.duration.ms{method="GET",endpoint="/users",status="200"}
```

## Analytics Query Patterns

### Time Range Patterns
```sql
-- Standard time windows
- 1h  (last hour)
- 24h (last 24 hours)  
- 7d  (last 7 days)
- 30d (last 30 days)
- mt  (month to date)
- q   (quarter to date)
```

### Aggregation Patterns
```sql
-- Standard aggregations
SELECT 
  time_bucket('1 minute', timestamp) as minute,
  COUNT(*) as total,
  AVG(duration_ms) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99,
  MAX(duration_ms) as max_duration
FROM metrics
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute;
```

### Query Template
```sql
-- Metric Query Template
WITH filtered AS (
  SELECT *
  FROM {{table}}
  WHERE timestamp >= {{start_time}}
    AND timestamp < {{end_time}}
    AND service = '{{service}}'
    {{#if endpoint}} AND endpoint = '{{endpoint}}' {{/if}}
)
SELECT 
  {{aggregation}}({{metric}}) as value,
  {{time_bucket}} as time
FROM filtered
GROUP BY time
ORDER BY time;
```

### Comparison Queries
```sql
-- Period-over-period
SELECT 
  current.period,
  current.value as current_value,
  previous.value as previous_value,
  ((current.value - previous.value) / previous.value * 100) as change_pct
FROM current_period current
JOIN previous_period previous ON current.period = previous.period;

-- Top N queries
SELECT 
  endpoint,
  COUNT(*) as request_count,
  AVG(duration_ms) as avg_duration
FROM api_requests
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY request_count DESC
LIMIT 10;
```

## Dashboard Hook Standards

### Hook Naming
```typescript
// Data fetching hooks
useMetrics(query: MetricQuery): MetricsResult
useDashboardData(dashboardId: string): DashboardData
useTimeRange(defaultRange: TimeRange): TimeRangeState

// Real-time hooks
useLiveMetrics(stream: string): LiveMetrics
useMetricAlerts(thresholds: AlertConfig[]): Alerts
```

### Hook Return Structure
```typescript
interface MetricResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  lastUpdated: Date;
}

interface DashboardData {
  widgets: WidgetData[];
  timeRange: TimeRange;
  isLive: boolean;
  refreshInterval: number;
}
```

### Standard Widget Data
```typescript
interface WidgetData {
  id: string;
  type: 'line' | 'bar' | 'gauge' | 'table' | 'stat';
  title: string;
  data: MetricPoint[];
  config: {
    unit?: string;
    thresholds?: Threshold[];
    comparison?: 'prev_period' | 'target';
  };
}

interface MetricPoint {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
}
```

### Dashboard Configuration
```typescript
const DASHBOARD_DEFAULTS = {
  refreshInterval: 30000,      // 30 seconds
  timeRange: '1h',             // Default time window
  maxDataPoints: 300,          // Max points per series
  timezone: 'UTC',
};

const WIDGET_PRESETS = {
  latency: {
    unit: 'ms',
    thresholds: [
      { value: 100, color: 'green' },
      { value: 500, color: 'yellow' },
      { value: 1000, color: 'red' },
    ],
  },
  errorRate: {
    unit: '%',
    thresholds: [
      { value: 1, color: 'green' },
      { value: 5, color: 'yellow' },
      { value: 10, color: 'red' },
    ],
  },
};
```

## Event Tracking Schemas

### Event Structure
```typescript
interface AnalyticsEvent {
  // Required
  event_name: string;          // snake_case
  event_timestamp: string;     // ISO 8601
  user_id: string | null;      // Anonymous = null
  session_id: string;
  
  // Context
  app_version: string;
  platform: 'web' | 'ios' | 'android';
  environment: 'prod' | 'staging';
  
  // Properties
  properties: EventProperties;
}
```

### Event Naming
```
[object]_[action]

Examples:
- user_signed_up
- order_completed
- checkout_started
- search_performed
- feature_flag_enabled
```

### Standard Events
```typescript
// Authentication
interface AuthEvent {
  event_name: 'user_signed_up' | 'user_logged_in' | 'user_logged_out';
  properties: {
    method: 'email' | 'oauth_google' | 'oauth_github';
    has_referral_code?: boolean;
  };
}

// Engagement
interface PageViewEvent {
  event_name: 'page_viewed';
  properties: {
    page_path: string;
    page_title: string;
    referrer: string;
    time_on_page_ms?: number;
  };
}

// E-commerce
interface EcommerceEvent {
  event_name: 'product_viewed' | 'cart_updated' | 'checkout_started' | 'order_completed';
  properties: {
    product_id?: string;
    category?: string;
    price?: number;
    currency?: string;
    quantity?: number;
    cart_value?: number;
    order_id?: string;
    payment_method?: string;
  };
}

// Feature Usage
interface FeatureEvent {
  event_name: 'feature_used';
  properties: {
    feature_name: string;
    feature_category: string;
    action: string;
    duration_ms?: number;
  };
}
```

### Event Validation
```typescript
const EVENT_SCHEMA = {
  required: ['event_name', 'event_timestamp', 'session_id'],
  maxProperties: 50,
  maxPropertyLength: 100,
  maxStringLength: 1024,
  maxArrayLength: 25,
  reservedProperties: ['timestamp', 'distinct_id', 'token'],
};

// Property naming
// - Use snake_case
// - No PII in property names
// - Prefix custom properties: c_*
// - Keep flat (avoid nesting > 2 levels)
```
