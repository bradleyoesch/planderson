import { spawnSync } from 'child_process';

import { version as currentVersion } from '../../../package.json';

export const stripVersionPrefix = (tag: string): string => tag.replace(/^v/, '');

export const runUpdate = async (): Promise<void> => {
    try {
        const res = await fetch('https://api.github.com/repos/bradleyoesch/planderson/releases/latest');
        const { tag_name: tagName } = (await res.json()) as { tag_name: string };
        const latest = stripVersionPrefix(tagName);

        if (latest === currentVersion) {
            console.log(`Already on latest version (v${currentVersion})`);
            process.exit(0);
        }

        console.log(`Updating planderson v${currentVersion} → v${latest}...`);
        const INSTALL_URL = 'https://raw.githubusercontent.com/bradleyoesch/planderson/main/install.sh';
        spawnSync('bash', ['-c', `curl -fsSL ${INSTALL_URL} | bash`], { stdio: 'inherit' });
    } catch (err) {
        console.error('planderson update failed:', err);
        process.exit(1);
    }
};
