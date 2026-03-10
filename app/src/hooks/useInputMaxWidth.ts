import { usePlanViewStaticContext } from '~/contexts/PlanViewProvider';
import { useTerminal } from '~/contexts/TerminalContext';

/**
 * Returns the maximum text width for inline input fields (command, comment, question).
 * Accounts for horizontal padding on both sides of the plan view.
 */
export const useInputMaxWidth = (): number => {
    const { terminalWidth } = useTerminal();
    const { paddingX } = usePlanViewStaticContext();
    return terminalWidth - paddingX * 2;
};
