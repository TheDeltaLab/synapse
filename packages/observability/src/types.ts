/**
 * Shared types for @trinity/observability.
 */

/**
 * Shared resource metadata for all OTel SDK configurations.
 * New resource attributes (e.g. service.instance.id) should be added here
 * to propagate to all platforms automatically.
 */
export interface BaseOtelConfig {
    /** Service name reported to the collector (e.g. 'web', 'worker', 'native'). */
    serviceName: string;
    /** Service version (e.g. '0.1.2'). Reported as `service.version` in OTel resource. */
    serviceVersion?: string;
    /** Deployment environment (e.g. 'test', 'staging', 'production'). Reported as `deployment.environment` in OTel resource. */
    deploymentEnvironment?: string;
}

/** Configuration for the Node.js OTel SDK. Extends BaseOtelConfig with Node.js-specific options. */
export interface NodeOtelConfig extends BaseOtelConfig {
    /** OTLP HTTP endpoint. Falls back to env OTEL_EXPORTER_OTLP_ENDPOINT. If neither is set, exporters are disabled and a warning is logged. */
    collectorUrl?: string;
    /** Enable distributed tracing. Default: true. */
    enableTraces?: boolean;
    /** Enable metrics collection. Default: true. */
    enableMetrics?: boolean;
    /** Enable log forwarding to Loki. Default: true. */
    enableLogs?: boolean;
    /** Patch console.log/warn/error to also forward to Loki. Default: false. Requires enableLogs. */
    enableConsolePatch?: boolean;
    /**
     * Whether to exit the process after an uncaughtException.
     * Default: true — Node.js docs recommend exiting because the process is in an undefined state.
     */
    exitOnUncaught?: boolean;
}

/** Configuration for the React Native OTel setup. Extends BaseOtelConfig with native-specific options. */
export interface NativeOtelConfig extends BaseOtelConfig {
    /** OTLP HTTP endpoint (the /api/otel proxy URL). Required — native has no env fallback. */
    collectorUrl: string;
}

/**
 * Shared type for request-scoped context attributes.
 * Used by both nodeRequestContext (AsyncLocalStorage) and nativeRequestContext (module-level).
 * Add new common attributes here to propagate to all platforms.
 */
export interface RequestContextAttributes {
    /** Authenticated user ID (OTel semantic convention: enduser.id) */
    'enduser.id'?: string;
    /** Unique request identifier for log correlation */
    'request.id'?: string;
    /** Client device identifier */
    'device.id'?: string;
    /** Business-level conversation ID */
    'conversation.id'?: string;
    /** Allow arbitrary string keys for extensibility */
    [key: string]: string | undefined;
}

/** Re-export official OTel Attributes type for structured log metadata. */
export type { Attributes as LogAttributes } from '@opentelemetry/api';

/** Configuration for the Edge Runtime logger. */
export interface EdgeLoggerConfig {
    /** Service name reported to the collector. */
    serviceName: string;
    /** OTLP HTTP endpoint. Falls back to env OTEL_EXPORTER_OTLP_ENDPOINT. If neither is set, logs only go to console. */
    collectorUrl?: string;
}

/** Configuration for the browser-side tracing provider. */
export interface WebProviderConfig {
    /** Service name reported to the collector (e.g. 'trinity-home-web'). */
    serviceName: string;
    /** OTLP trace endpoint URL. Defaults to `${window.location.origin}/api/otel/v1/traces`. */
    traceUrl?: string;
}
