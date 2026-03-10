import { AppProps } from '~/App';
import { DEFAULT_SETTINGS } from '~/utils/config/settings';

/**
 * Default props for integration tests
 * Use with spread operator: <App {...DEFAULT_APP_PROPS} />
 * Override specific props as needed: <App {...DEFAULT_APP_PROPS} mode="socket" />
 */
export const DEFAULT_APP_PROPS: Omit<AppProps, 'filepath'> & { filepath: string } = {
    sessionId: 'test123',
    mode: 'file',
    filepath: '', // Override this in tests with actual file path
    settings: DEFAULT_SETTINGS,
};
