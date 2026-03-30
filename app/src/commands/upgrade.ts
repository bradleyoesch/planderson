import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { loadSettings, Settings } from '~/utils/config/settings';
import { generateId } from '~/utils/id';

import { version } from '../../../package.json';
import { BASH_SCRIPT, ZSH_SCRIPT } from './completions';

export const currentVersion = version;

export const RELEASES_URL = 'https://github.com/bradleyoesch/planderson/releases';

export const stripVersionPrefix = (tag: string): string => tag.replace(/^v/, '');

export const isNewerVersion = (latest: string, current: string): boolean => {
    const [lMaj, lMin, lPat] = latest.split('.').map(Number);
    const [cMaj, cMin, cPat] = current.split('.').map(Number);
    if (lMaj !== cMaj) return lMaj > cMaj;
    if (lMin !== cMin) return lMin > cMin;
    return lPat > cPat;
};

export const fetchLatestVersion = async (): Promise<string | null> => {
    const res = await fetch('https://github.com/bradleyoesch/planderson/releases/latest');
    const tag = res.url.split('/').pop();
    return tag ? stripVersionPrefix(tag) : null;
};

export const categorizeVersionBump = (latest: string, current: string): 'patch' | 'minor' | 'major' => {
    const [lMaj, lMin] = latest.split('.').map(Number);
    const [cMaj, cMin] = current.split('.').map(Number);
    if (lMaj !== cMaj) return 'major';
    if (lMin !== cMin) return 'minor';
    return 'patch';
};

export const shouldAutoUpgrade = (setting: Settings['autoUpgrade'], latest: string, current: string): boolean => {
    if (setting === 'never') return false;
    const bump = categorizeVersionBump(latest, current);
    if (bump === 'patch') return true;
    if (bump === 'minor') return setting === 'minor' || setting === 'always';
    // major
    return setting === 'always';
};

const INSTALL_URL = 'https://raw.githubusercontent.com/bradleyoesch/planderson/main/install.sh';

export const regenerateCompletions = (): void => {
    const completionsDir = path.join(os.homedir(), '.planderson', 'completions');
    (['bash', 'zsh'] as const).forEach((shell) => {
        const completionsFile = path.join(completionsDir, `planderson.${shell}`);
        if (fs.existsSync(completionsFile)) {
            fs.writeFileSync(completionsFile, shell === 'zsh' ? ZSH_SCRIPT : BASH_SCRIPT);
        }
    });
};

export const runSilentUpgrade = (): Promise<'success' | 'failure'> => {
    return new Promise((resolve) => {
        const child = spawn('bash', ['-c', `curl -fsSL ${INSTALL_URL} | bash`], { stdio: 'ignore' });
        child.on('close', (code) => {
            if (code === 0) regenerateCompletions();
            resolve(code === 0 ? 'success' : 'failure');
        });
    });
};

export const runUpgrade = async (): Promise<void> => {
    let latest: string | null;
    try {
        latest = await fetchLatestVersion();
    } catch (err) {
        console.error('planderson upgrade failed:', err);
        process.exit(1);
        return;
    }

    const settings = loadSettings(generateId());

    if (latest === version) {
        console.log(`Already on latest version (v${version})`);
        if (settings.autoUpgrade === 'never') {
            console.log(`Tip: run \`planderson settings --autoUpgrade always\` to upgrade automatically`);
        }
        console.log(`Releases: ${RELEASES_URL}`);
        process.exit(0);
        return;
    }

    if (!latest) {
        console.warn('Warning: could not determine latest version, installing anyway...');
    } else {
        console.log(`Updating planderson v${version} → v${latest}...`);
    }
    spawnSync('bash', ['-c', `curl -fsSL ${INSTALL_URL} | bash`], { stdio: 'inherit' });
    regenerateCompletions();
    console.log(`Releases: ${RELEASES_URL}`);
};
