import { spawnSync } from 'child_process';

import { version } from '../../../package.json';

export const currentVersion = version;

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

export const runUpgrade = async (): Promise<void> => {
    try {
        const latest = await fetchLatestVersion();

        if (latest === version) {
            console.log(`Already on latest version (v${version})`);
            process.exit(0);
        }

        if (!latest) {
            console.warn('Warning: could not determine latest version, installing anyway...');
        } else {
            console.log(`Updating planderson v${version} → v${latest}...`);
        }
        const INSTALL_URL = 'https://raw.githubusercontent.com/bradleyoesch/planderson/main/install.sh';
        spawnSync('bash', ['-c', `curl -fsSL ${INSTALL_URL} | bash`], { stdio: 'inherit' });
    } catch (err) {
        console.error('planderson upgrade failed:', err);
        process.exit(1);
    }
};
