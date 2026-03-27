import { parseArguments } from '~/utils/cli/args';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings, SETTINGS_DOCS } from '~/utils/config/settings';
import { generateId } from '~/utils/id';

const LABEL_WIDTH = Math.max('Current value'.length, 'Valid values'.length, 'Description'.length);

export const runSettings = (args: string[]): void => {
    const GREEN = process.stdout.isTTY ? '\x1b[32m' : '';
    const GREY = process.stdout.isTTY ? '\x1b[90m' : '';
    const RED = process.stderr.isTTY ? '\x1b[31m' : '';
    const RESET = process.stdout.isTTY || process.stderr.isTTY ? '\x1b[0m' : '';

    const sessionId = generateId();
    const { remainingArgs } = parseArguments(args);

    // Collect --key value? pairs from remaining args
    // value is null when no value follows the flag (signals detail mode)
    const updates: Array<{ key: string; value: string | null }> = remainingArgs.reduce(
        (acc: Array<{ key: string; value: string | null }>, arg, i) => {
            if (!arg.startsWith('--')) return acc;
            const key = arg.slice(2);
            const next = remainingArgs[i + 1] ?? '';
            const value = !next || next.startsWith('--') ? null : next;
            acc.push({ key, value });
            return acc;
        },
        [],
    );

    const settingsKeys = (Object.keys(SETTINGS_DOCS) as (keyof Settings)[]).sort((a, b) => a.localeCompare(b));
    const keyWidth = Math.max(...settingsKeys.map((k) => k.length));

    let current: Settings;
    try {
        current = loadSettings(sessionId);
    } catch {
        current = DEFAULT_SETTINGS;
    }

    const printSettingsHelp = (): void => {
        const valueWidth = Math.max(...settingsKeys.map((k) => String(current[k]).length));
        const validValuesWidth = Math.max(
            ...settingsKeys.map((k) => SETTINGS_DOCS[k].validValues.map((v) => v.value).join(' | ').length),
        );
        settingsKeys.forEach((k) => {
            const doc = SETTINGS_DOCS[k];
            const validValues = doc.validValues.map((v) => v.value).join(' | ');
            console.log(
                `  ${k.padEnd(keyWidth)}  ${String(current[k]).padEnd(valueWidth)}  ${validValues.padEnd(validValuesWidth)}  ${doc.description}`,
            );
        });
        console.log('');
        console.log('To view a setting: `planderson settings --<key>`');
        console.log('To set a setting: `planderson settings --<key> <value>`');
    };

    const printSettingDetail = (key: keyof Settings): void => {
        const doc = SETTINGS_DOCS[key];
        const indent = '  ';
        const gap = '  ';
        const subIndent = ' '.repeat(indent.length + LABEL_WIDTH + gap.length + indent.length);
        const maxValueWidth = Math.max(...doc.validValues.map((v) => v.value.length));
        const validValuesList = doc.validValues.map((v) => v.value).join(' | ');

        console.log(key);
        console.log('');
        console.log(`${indent}${'Current value'.padEnd(LABEL_WIDTH)}${gap}${String(current[key])}`);
        console.log(`${indent}${'Valid values'.padEnd(LABEL_WIDTH)}${gap}${validValuesList}`);
        doc.validValues.forEach((v) => {
            console.log(`${subIndent}${v.value.padEnd(maxValueWidth)}  ${v.description}`);
        });
        console.log(`${indent}${'Description'.padEnd(LABEL_WIDTH)}${gap}${doc.description}`);
        console.log('');
        console.log('To update:');
        console.log(`${indent}planderson settings --${key} <value>`);
    };

    const validKeys = new Set(Object.keys(SETTINGS_DOCS));

    // Detail mode: all flags have no value
    const isDetailMode = updates.length > 0 && updates.every(({ value }) => value === null);
    if (isDetailMode) {
        updates.forEach(({ key }) => {
            if (!validKeys.has(key)) {
                console.error(`${RED}Unknown setting: '${key}'${RESET}`);
                process.exit(2);
            }
            printSettingDetail(key as keyof Settings);
        });
        process.exit(0);
    }

    // Display mode: no update flags provided
    if (updates.length === 0) {
        console.log('Settings for planderson');
        console.log('');
        printSettingsHelp();
        process.exit(0);
    }

    // Update mode: process all updates, collect errors, print help once at end
    const errors: string[] = [];

    updates.forEach(({ key, value }) => {
        if (!validKeys.has(key)) {
            errors.push(`Unknown setting: '${key}'`);
            return;
        }

        try {
            saveSettings(sessionId, { [key]: value ?? '' } as Partial<Record<keyof Settings, unknown>>);
            current = { ...current, [key]: value ?? '' };
            console.log(`${GREEN}✓${RESET} ${GREY}Set ${key}: ${value ?? ''}${RESET}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(
                message.includes('Invalid settings.json')
                    ? `Invalid value '${value ?? ''}' for setting '${key}'`
                    : message,
            );
        }
    });

    if (errors.length > 0) {
        errors.forEach((e) => console.error(`${RED}${e}${RESET}`));
        console.error('');
        printSettingsHelp();
        process.exit(1);
    }

    process.exit(0);
};

if (import.meta.main) {
    runSettings(process.argv.slice(2));
}
