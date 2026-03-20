import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

import { logError, logEvent } from '~/utils/io/logger';
import { getPlandersonBaseDir } from '~/utils/io/paths';

/**
 * Settings schema with validation
 * All settings have defaults for backwards compatibility
 */
export const SettingsSchema = z.object({
    approveAction: z.enum(['approve', 'exit']).default('approve'),
    launchMode: z.enum(['auto-tmux', 'manual']).default('manual'),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
    approveAction: 'approve',
    launchMode: 'manual',
};

/**
 * Documentation and valid values for each setting — kept co-located with the schema
 * so valid values stay in sync.
 */
export const SETTINGS_DOCS: Record<
    keyof Settings,
    { validValues: Array<{ value: string; description: string }>; description: string }
> = {
    launchMode: {
        validValues: [
            {
                value: 'manual',
                description: 'Requires manual launch of TUI either directly or through integrations',
            },
            { value: 'auto-tmux', description: 'Automatically launches TUI in tmux pane when a plan is ready' },
        ],
        description: 'Trigger for launching TUI',
    },
    approveAction: {
        validValues: [
            { value: 'approve', description: 'Submits the plan for Claude to continue executing' },
            {
                value: 'exit',
                description: 'On approve, exits the TUI',
            },
        ],
        description: 'Action taken when the plan is approved in the TUI',
    },
};

/**
 * Get path to settings file — uses getPlandersonBaseDir() so it follows dev.json in dev mode,
 * ~/.planderson in prod.
 */
export const getSettingsPath = (): string => {
    return path.join(getPlandersonBaseDir(), 'settings.json');
};

/**
 * Load settings from disk.
 * - Returns defaults if file doesn't exist (graceful)
 * - Throws error if file exists but is malformed (fail fast)
 * - Hot-reloads on each call (reads fresh from disk)
 */
export const loadSettings = (sessionId: string): Settings => {
    const settingsPath = getSettingsPath();

    logEvent(__filename, sessionId, 'settings.started', `path=${settingsPath}`);

    // Graceful: return defaults if file doesn't exist
    if (!fs.existsSync(settingsPath)) {
        logEvent(__filename, sessionId, 'settings.notfound', 'Using default settings');
        return DEFAULT_SETTINGS;
    }

    try {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);

        // Validate and apply defaults for missing fields
        const validated = SettingsSchema.parse(parsed);
        logEvent(__filename, sessionId, 'settings.loaded', `from:${settingsPath}`);
        return validated;
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logError(__filename, sessionId, 'settings.failed', error);
        // Fail fast: throw descriptive error for malformed settings
        if (err instanceof z.ZodError) {
            const errors = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Invalid settings.json: ${errors}`);
        }
        if (err instanceof SyntaxError) {
            throw new Error(`Invalid JSON in settings.json: ${err.message}`);
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load settings.json: ${errorMessage}`);
    }
};

/**
 * Save settings to disk, merging updates into any existing file.
 * Validates the merged result via SettingsSchema before writing.
 * Throws a descriptive error if the merged settings are invalid.
 */
export const saveSettings = (sessionId: string, updates: Partial<Record<keyof Settings, unknown>>): Settings => {
    const settingsPath = getSettingsPath();

    let existing: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
        try {
            existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
        } catch {
            // overwrite malformed file
        }
    }

    try {
        const validated = SettingsSchema.parse({ ...existing, ...updates });
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify(validated, null, 4));
        logEvent(__filename, sessionId, 'settings.saved', `path=${settingsPath}`);
        return validated;
    } catch (err) {
        if (err instanceof z.ZodError) {
            const errors = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Invalid settings.json: ${errors}`);
        }
        throw err;
    }
};
