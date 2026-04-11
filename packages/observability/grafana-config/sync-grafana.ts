#!/usr/bin/env tsx
/**
 * Sync Grafana configuration from local files to Azure Managed Grafana.
 *
 * Syncs: dashboards, alert rules, templates, contact points, notification policies.
 *
 * Usage:
 *   npx tsx sync-grafana.ts <bearer-token> <grafana-url>
 *
 * Example:
 *   TOKEN=$(az account get-access-token --resource "ce34e7e5-..." --query accessToken -o tsv)
 *   npx tsx sync-grafana.ts "$TOKEN" "https://test.grafana.thebrainly.dev"
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import yaml from 'js-yaml';

// ── Types ──────────────────────────────────────────────────────────

interface ApiResponse {
    status: number;
    body: Record<string, unknown>;
}

interface AlertRule {
    uid?: string;
    title?: string;
    condition?: string;
    data?: unknown[];
    noDataState?: string;
    execErrState?: string;
    for?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
    ruleGroup?: string;
    folderUID?: string;
    isPaused?: boolean;
}

interface ContactPoint {
    uid?: string;
    name?: string;
    [key: string]: unknown;
}

interface NotificationPolicy {
    orgId?: number;
    [key: string]: unknown;
}

// ── API Client ─────────────────────────────────────────────────────

async function apiCall(
    baseUrl: string,
    token: string,
    method: string,
    path: string,
    data?: unknown,
): Promise<ApiResponse> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Disable-Provenance': 'true',
    };
    const options: RequestInit = { method, headers };
    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const resp = await fetch(url, options);
        const text = await resp.text();
        const body = text ? JSON.parse(text) : {};
        return { status: resp.status, body };
    } catch (error) {
        return { status: 0, body: { message: String(error) } };
    }
}

// ── Sync Functions ─────────────────────────────────────────────────

async function ensureFolder(baseUrl: string, token: string, title: string, uid: string): Promise<string> {
    const { status, body } = await apiCall(baseUrl, token, 'POST', '/api/folders', { title, uid });
    if (status === 409 || status === 412) {
        console.log(`  Folder "${title}" already exists`);
        return uid;
    } else if (status === 200) {
        const folderUid = (body as Record<string, string>).uid ?? uid;
        console.log(`  Folder "${title}" created (uid: ${folderUid})`);
        return folderUid;
    } else {
        console.log(`  Warning: folder creation returned ${status}: ${JSON.stringify(body)}`);
        return uid;
    }
}

async function syncTemplate(baseUrl: string, token: string, name: string, content: string): Promise<boolean> {
    const { status } = await apiCall(baseUrl, token, 'PUT', `/api/v1/provisioning/templates/${name}`, {
        template: content,
    });
    if ([200, 201, 202].includes(status)) {
        console.log(`  ✅ Template "${name}" synced`);
        return true;
    }
    console.log(`  ❌ Template "${name}" failed (${status})`);
    return false;
}

async function syncContactPoint(baseUrl: string, token: string, cp: ContactPoint): Promise<boolean> {
    const uid = cp.uid ?? '';
    const name = cp.name ?? '';

    // Check if exists
    const { status: listStatus, body: existing } = await apiCall(baseUrl, token, 'GET', '/api/v1/provisioning/contact-points');
    const exists = listStatus === 200
        && Array.isArray(existing)
        && existing.some((e: ContactPoint) => e.uid === uid);

    const { status } = exists
        ? await apiCall(baseUrl, token, 'PUT', `/api/v1/provisioning/contact-points/${uid}`, cp)
        : await apiCall(baseUrl, token, 'POST', '/api/v1/provisioning/contact-points', cp);

    if ([200, 201, 202].includes(status)) {
        console.log(`  ✅ Contact point "${name}" ${exists ? 'updated' : 'created'}`);
        return true;
    }
    console.log(`  ❌ Contact point "${name}" failed (${status})`);
    return false;
}

async function syncAlertRule(baseUrl: string, token: string, rule: AlertRule, folderUid: string): Promise<boolean> {
    rule.folderUID = folderUid;
    const uid = rule.uid ?? '';
    const title = rule.title ?? '';

    const { status } = await apiCall(baseUrl, token, 'POST', '/api/v1/provisioning/alert-rules', rule);
    if ([200, 201].includes(status)) {
        console.log(`  ✅ ${title}`);
        return true;
    }
    if (status === 409) {
        // Already exists, update
        const { status: status2 } = await apiCall(baseUrl, token, 'PUT', `/api/v1/provisioning/alert-rules/${uid}`, rule);
        if ([200, 201].includes(status2)) {
            console.log(`  ✅ ${title} (updated)`);
            return true;
        }
        console.log(`  ❌ ${title} update failed (${status2})`);
        return false;
    }
    console.log(`  ❌ ${title} (${status})`);
    return false;
}

async function syncNotificationPolicy(baseUrl: string, token: string, policy: NotificationPolicy): Promise<boolean> {
    const { status } = await apiCall(baseUrl, token, 'PUT', '/api/v1/provisioning/policies', policy);
    if ([200, 202].includes(status)) {
        console.log('  ✅ Notification policy updated');
        return true;
    }
    console.log(`  ❌ Notification policy failed (${status})`);
    return false;
}

async function syncDashboard(baseUrl: string, token: string, filePath: string, defaultFolderUid = 'trinity'): Promise<boolean> {
    const raw = readFileSync(filePath, 'utf-8');
    const dashboard = JSON.parse(raw);
    const title = dashboard.title ?? filePath;
    const folderUid = dashboard._folderUid ?? defaultFolderUid;
    delete dashboard._folderUid;
    delete dashboard.version;

    const payload = {
        dashboard,
        folderUid,
        overwrite: true,
        message: `Synced from ${filePath.split('/').pop()}`,
    };

    const { status, body } = await apiCall(baseUrl, token, 'POST', '/api/dashboards/db', payload);
    if ([200, 201].includes(status)) {
        const version = (body as Record<string, unknown>).version ?? '?';
        console.log(`  ✅ ${title} → folder:${folderUid} (v${version})`);
        return true;
    }
    console.log(`  ❌ ${title} (${status}): ${JSON.stringify(body)}`);
    return false;
}

// ── Parsers ────────────────────────────────────────────────────────

interface AlertingConfig {
    templates: Record<string, string>;
    contactPoints: ContactPoint[];
    policies: NotificationPolicy[];
}

function parseAlertingConfig(filePath: string): AlertingConfig {
    const raw = readFileSync(filePath, 'utf-8');
    const data = yaml.load(raw) as Record<string, unknown[]>;

    const templates: Record<string, string> = {};
    for (const tpl of (data.templates ?? []) as Array<{ name: string; template: string }>) {
        templates[tpl.name] = tpl.template;
    }

    const contactPoints: ContactPoint[] = [];
    for (const group of (data.contactPoints ?? []) as Array<{ name: string; receivers: ContactPoint[] }>) {
        for (const receiver of group.receivers) {
            if (!receiver.name) {
                receiver.name = group.name;
            }
            contactPoints.push(receiver);
        }
    }

    const policies = (data.policies ?? []) as NotificationPolicy[];

    return { templates, contactPoints, policies };
}

function parseAlertRulesYaml(filePath: string): AlertRule[] {
    const raw = readFileSync(filePath, 'utf-8');
    const data = yaml.load(raw) as { groups?: Array<{ name: string; rules: Record<string, unknown>[] }> };

    const rules: AlertRule[] = [];
    for (const group of data.groups ?? []) {
        const ruleGroup = group.name ?? 'Default';
        for (const rule of group.rules) {
            rules.push({
                uid: rule.uid as string ?? '',
                title: rule.title as string ?? '',
                condition: rule.condition as string ?? 'C',
                data: rule.data as unknown[] ?? [],
                noDataState: rule.noDataState as string ?? 'OK',
                execErrState: rule.execErrState as string ?? 'Error',
                for: rule.for as string ?? '5m',
                annotations: rule.annotations as Record<string, string> ?? {},
                labels: rule.labels as Record<string, string> ?? {},
                ruleGroup,
                isPaused: false,
            });
        }
    }
    return rules;
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const [token, grafanaUrl] = process.argv.slice(2);

    if (!token || !grafanaUrl) {
        console.log('Usage: npx tsx sync-grafana.ts <bearer-token> <grafana-url>');
        console.log('');
        console.log('Example:');
        console.log('  TOKEN=$(az account get-access-token --resource "ce34e7e5-..." --query accessToken -o tsv)');
        console.log('  npx tsx sync-grafana.ts "$TOKEN" "https://test.grafana.thebrainly.dev"');
        process.exit(0);
    }

    const baseUrl = grafanaUrl.replace(/\/$/, '');
    // Config files are in the same directory as this script
    const grafanaConfigDir = import.meta.dirname;
    const alertingConfig = join(grafanaConfigDir, 'alerting', 'alerting.yaml');
    const alertingRulesDir = join(grafanaConfigDir, 'alerting');
    const dashboardsDir = join(grafanaConfigDir, 'dashboards');

    // Verify connectivity
    console.log('=== Verifying Grafana connectivity ===');
    const { status: healthStatus, body: healthBody } = await apiCall(baseUrl, token, 'GET', '/api/health');
    if (healthStatus !== 200) {
        console.error(`Error: Cannot reach Grafana (status: ${healthStatus})`);
        process.exit(1);
    }
    console.log(`  Connected to Grafana ${(healthBody as Record<string, string>).version ?? 'unknown'}`);

    // Parse local config
    console.log('\n=== Parsing local config ===');
    const { templates, contactPoints, policies } = parseAlertingConfig(alertingConfig);
    console.log(`  Templates: ${JSON.stringify(Object.keys(templates))}`);
    console.log(`  Contact points: ${JSON.stringify(contactPoints.map(cp => cp.name))}`);
    console.log(`  Policies: ${policies.length}`);

    const allRules: AlertRule[] = [];
    try {
        const yamlFiles = readdirSync(alertingRulesDir).filter(f => f.endsWith('.yaml') && f !== 'alerting.yaml').sort();
        for (const file of yamlFiles) {
            const rules = parseAlertRulesYaml(join(alertingRulesDir, file));
            console.log(`  Rules from ${file}: ${rules.length}`);
            allRules.push(...rules);
        }
    } catch {
        console.log('  No alerting rules directory found');
    }

    // Ensure folder
    console.log('\n=== Ensuring folder ===');
    const folderUid = await ensureFolder(baseUrl, token, 'Trinity', 'trinity');

    // Sync templates
    console.log('\n=== Syncing templates ===');
    for (const [name, content] of Object.entries(templates)) {
        await syncTemplate(baseUrl, token, name, content);
    }

    // Sync contact points
    console.log('\n=== Syncing contact points ===');
    for (const cp of contactPoints) {
        await syncContactPoint(baseUrl, token, cp);
    }

    // Sync alert rules
    console.log(`\n=== Syncing alert rules (${allRules.length}) ===`);
    for (const rule of allRules) {
        await syncAlertRule(baseUrl, token, rule, folderUid);
    }

    // Sync notification policies
    if (policies.length > 0) {
        console.log('\n=== Syncing notification policy ===');
        const policy = { ...policies[0] };
        delete policy.orgId;
        await syncNotificationPolicy(baseUrl, token, policy);
    }

    // Sync dashboards
    try {
        const dashFiles = readdirSync(dashboardsDir).filter(f => f.endsWith('.json')).sort();
        if (dashFiles.length > 0) {
            console.log(`\n=== Syncing dashboards (${dashFiles.length}) ===`);
            for (const file of dashFiles) {
                await syncDashboard(baseUrl, token, join(dashboardsDir, file));
            }
        }
    } catch {
        console.log('  No dashboards directory found');
    }

    // Verify
    console.log('\n=== Verification ===');
    const { body: rulesResp } = await apiCall(baseUrl, token, 'GET', '/api/v1/provisioning/alert-rules');
    const ruleCount = Array.isArray(rulesResp) ? rulesResp.length : 0;
    console.log(`  Alert rules: ${ruleCount}`);

    const { body: cpResp } = await apiCall(baseUrl, token, 'GET', '/api/v1/provisioning/contact-points');
    const cpNames = Array.isArray(cpResp) ? cpResp.map((cp: ContactPoint) => cp.name) : [];
    console.log(`  Contact points: ${JSON.stringify(cpNames)}`);

    const { body: tplResp } = await apiCall(baseUrl, token, 'GET', '/api/v1/provisioning/templates');
    const tplNames = Array.isArray(tplResp) ? tplResp.map((t: { name: string }) => t.name) : [];
    console.log(`  Templates: ${JSON.stringify(tplNames)}`);

    console.log(`\n✅ Sync complete — ${ruleCount} rules, ${cpNames.length} contact points, ${tplNames.length} templates`);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
