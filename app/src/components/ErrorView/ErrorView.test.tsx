import { describe, expect, test } from 'bun:test';
import React from 'react';

import { renderWithTerminalProvider as render } from '~/test-utils/render-helpers';

import { ErrorView } from './ErrorView';

describe('ErrorView', () => {
    test('should render error message', () => {
        const { lastFrame } = render(<ErrorView error="Something went wrong" />);

        expect(lastFrame()).toContain('Error');
        expect(lastFrame()).toContain('Something went wrong');
    });

    test('should render exit instruction', () => {
        const { lastFrame } = render(<ErrorView error="Test error" />);

        expect(lastFrame()).toContain('Press any key to exit');
    });
    test('should handle empty error message', () => {
        const { lastFrame } = render(<ErrorView error="" />);

        expect(lastFrame()).toContain('Error');
    });

    test('should handle multiline error messages', () => {
        const multilineError = 'Line 1\nLine 2\nLine 3';
        const { lastFrame } = render(<ErrorView error={multilineError} />);

        expect(lastFrame()).toContain('Line 1');
        expect(lastFrame()).toContain('Line 2');
        expect(lastFrame()).toContain('Line 3');
    });

    test('should handle error with special characters', () => {
        const specialError = 'Error: <script>alert("xss")</script>';
        const { lastFrame } = render(<ErrorView error={specialError} />);

        expect(lastFrame()).toContain(specialError);
    });
});
