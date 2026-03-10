/**
 * Global test setup file for all tests.
 * This sets up the DOM environment needed for testing React hooks with @testing-library/react.
 * Also ensures consistent terminal rendering for snapshot tests.
 */
import { Window } from 'happy-dom';

// Only set up DOM if it doesn't already exist
if (typeof global.document === 'undefined') {
    const window = new Window();
    global.document = window.document as any;
    global.window = window as any;
    global.HTMLElement = window.HTMLElement as any;
    global.Element = window.Element as any;
}

// Suppress "multiple renderers" warning. Bun runs all test files in a single process,
// so @testing-library/react (react-dom) and Ink's renderer coexist. React warns when
// both touch the same context providers. Cannot be scoped to a file since it depends
// on which files happen to share the process.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Detected multiple renderers')) return;
    originalConsoleError(...args);
};

// Suppress Node.js runtime warnings (MaxListenersExceeded, etc.)
process.emitWarning = () => {};

// Force color output for consistent snapshot rendering with ANSI codes
// This ensures snapshots include colors regardless of environment
process.env.FORCE_COLOR = '3'; // Force truecolor support

// Force stdout to TTY mode so Ink renders with colors
if (process.stdout) {
    Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: false,
        configurable: true,
    });

    // Pin terminal dimensions so tests produce consistent output regardless
    // of the developer's terminal size. Uses getters (not value descriptors)
    // to preserve the TTY stream property type, which color detection
    // libraries depend on.
    Object.defineProperty(process.stdout, 'columns', {
        get: () => 80,
        set: () => {},
        configurable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
        get: () => 24,
        set: () => {},
        configurable: true,
    });
}
