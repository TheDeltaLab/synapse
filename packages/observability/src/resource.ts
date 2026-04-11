/**
 * Shared OTel resource creation for Node.js and React Native.
 */
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// OTel semantic convention for deployment environment.
// `SEMRESATTRS_DEPLOYMENT_ENVIRONMENT` is deprecated in @opentelemetry/semantic-conventions@1.40.0,
// and the replacement `ATTR_DEPLOYMENT_ENVIRONMENT_NAME` is not yet available in stable exports.
// Use the string literal directly until the package is upgraded.
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

export interface ResourceOptions {
    /** Service version (e.g. '0.1.2'). Maps to `service.version`. */
    version?: string;
    /** Deployment environment (e.g. 'test', 'staging', 'production'). Maps to `deployment.environment.name`. */
    environment?: string;
    /** Platform identifier (e.g. 'react-native', 'nodejs'). */
    platform?: string;
}

/**
 * Create an OTel Resource with service identity and deployment context.
 *
 * @param serviceName - e.g. 'web', 'worker', 'lance'
 * @param options - optional version, environment, and platform attributes
 *
 * TODO: Future resource attributes to add:
 * - `service.instance.id` — K8s pod name (from env HOSTNAME or POD_NAME)
 * - `device.id` — native device identifier
 * - `client.version` — native app version (from Expo Constants)
 */
export function createResource(serviceName: string, options: ResourceOptions = {}) {
    const { version, environment, platform } = options;

    const attributes: Record<string, string> = {
        [ATTR_SERVICE_NAME]: serviceName,
    };

    if (version) {
        attributes[ATTR_SERVICE_VERSION] = version;
    }

    if (environment) {
        attributes[ATTR_DEPLOYMENT_ENVIRONMENT] = environment;
    }

    if (platform) {
        attributes['telemetry.sdk.language'] = 'js';
        attributes['telemetry.sdk.platform'] = platform;
    }

    return resourceFromAttributes(attributes);
}
