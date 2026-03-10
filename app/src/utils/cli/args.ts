export interface ParsedArguments {
    registryId: string | null;
    sessionId: string | null;
    filepath: string | null;
    remainingArgs: string[];
}

/**
 * Extract a flag and its value from args array
 * Mutates the args array by removing the flag and value if found
 */
const extractFlag = (args: string[], flag: string): string | null => {
    const flagIndex = args.indexOf(flag);
    if (flagIndex !== -1 && args[flagIndex + 1]) {
        const value = args[flagIndex + 1];
        args.splice(flagIndex, 2);
        return value;
    }
    return null;
};

/**
 * Parse command line arguments for Planderson TUI
 *
 * Supports:
 * - Registry ID: --pane <id> or --registry <id> (backward compatible)
 * - Session ID: --session <id>
 * - File path: --file <path> or positional argument
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @returns Parsed arguments with registry ID, session ID, filepath, and remaining args
 */
export const parseArguments = (args: string[]): ParsedArguments => {
    const argsCopy = [...args];

    // Parse registry ID (--pane for backward compatibility, --registry preferred)
    const registryId = extractFlag(argsCopy, '--registry') ?? extractFlag(argsCopy, '--pane');

    // Parse session ID
    const sessionId = extractFlag(argsCopy, '--session');

    // Parse file path (--file flag or single positional argument)
    let filepath = extractFlag(argsCopy, '--file');
    if (!filepath && argsCopy.length === 1 && !argsCopy[0].startsWith('-')) {
        // Only treat as file if it's the sole remaining argument
        filepath = argsCopy[0];
        argsCopy.shift();
    }

    return {
        registryId,
        sessionId,
        filepath,
        remainingArgs: argsCopy,
    };
};
