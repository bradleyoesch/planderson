/**
 * View assertion helpers for integration tests
 *
 * Helpers for verifying different view states: plan view, help view, error view, command mode.
 */

import { stripAnsi } from '~/test-utils/ink-helpers';

/**
 * View identifiers - unique text that appears in each view
 */
const VIEW_MARKERS = {
    PLAN: 'Review plan',
    HELP: 'Navigation',
    ERROR: 'Error',
    COMMAND: ':',
} as const;

/**
 * Check if currently in the main plan view
 */
export const isInPlanView = function (frame: string): boolean {
    return frame.includes(VIEW_MARKERS.PLAN);
};

/**
 * Check if currently in help view
 */
export const isInHelpView = function (frame: string): boolean {
    return frame.includes(VIEW_MARKERS.HELP) && frame.includes('Keybindings');
};

/**
 * Check if currently in error view
 */
export const isInErrorView = function (frame: string): boolean {
    return frame.includes(VIEW_MARKERS.ERROR);
};

/**
 * Check if currently in command mode (command prompt visible)
 */
export const isInCommandMode = function (frame: string): boolean {
    const lines = frame.split('\n');

    // Command prompt appears at the bottom of the frame
    // Look for lines starting with ':'
    return lines.some((line) => {
        const stripped = stripAnsi(line).trim();
        return stripped.startsWith(':');
    });
};

/**
 * Get the current command prompt text (e.g., ":d", ":wq")
 * Returns null if not in command mode
 */
export const getCommandPrompt = function (frame: string): string | null {
    if (!isInCommandMode(frame)) return null;

    const lines = frame.split('\n');

    // Find the command line
    const commandLine = lines.find((line) => {
        const stripped = stripAnsi(line).trim();
        return stripped.startsWith(':');
    });

    return commandLine ? stripAnsi(commandLine).trim() : null;
};

/**
 * Check if help view contains a specific section
 */
export const hasHelpSection = function (frame: string, sectionName: string): boolean {
    if (!isInHelpView(frame)) return false;
    return frame.includes(sectionName);
};

/**
 * Get error message from error view
 * Returns null if not in error view
 */
export const getErrorMessage = function (frame: string): string | null {
    if (!isInErrorView(frame)) return null;

    const lines = frame.split('\n').map((line) => stripAnsi(line));

    // Find the line after "Error" header
    const errorIndex = lines.findIndex((line) => line.includes('Error'));
    if (errorIndex === -1 || errorIndex >= lines.length - 1) return null;

    // Get the next non-empty line as the error message
    const linesAfterError = lines.slice(errorIndex + 1);
    const errorLine = linesAfterError.find((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.match(/^[─━-]+$/);
    });

    return errorLine ? errorLine.trim() : null;
};

/**
 * Check if confirmation view is shown
 * (Used for approve/deny confirmations)
 */
export const isInConfirmationView = function (frame: string): boolean {
    return frame.includes('Press') && (frame.includes('confirm') || frame.includes('Confirm'));
};

/**
 * Check if approval confirmation is shown
 */
export const isShowingApprovalConfirmation = function (frame: string): boolean {
    return (
        isInConfirmationView(frame) &&
        (frame.includes('approve') || frame.includes('Approve') || frame.includes('accept'))
    );
};

/**
 * Check if denial confirmation is shown
 */
export const isShowingDenialConfirmation = function (frame: string): boolean {
    // Check for "Send feedback" header (confirms we're in denial confirmation)
    return frame.includes('Send feedback') || (isInConfirmationView(frame) && frame.includes('deny'));
};

/**
 * Check if the update notification is visible in the footer
 */
export const hasUpdateNotification = function (frame: string): boolean {
    return stripAnsi(frame).includes('planderson upgrade');
};

/**
 * Get the view header text (e.g., "Review Plan", "Help", "Error")
 */
export const getViewHeader = function (frame: string): string | null {
    const lines = frame.split('\n').map((line) => stripAnsi(line));

    // Header is typically on the second line (after top border)
    if (lines.length < 2) return null;

    const headerLine = lines[1].trim();
    return headerLine.length > 0 ? headerLine : null;
};
