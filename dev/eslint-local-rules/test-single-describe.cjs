/**
 * ESLint rule to enforce that test files have exactly ONE root describe block.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce test files have exactly one root-level describe block',
            category: 'Best Practices',
            recommended: true,
        },
        messages: {
            noRootDescribe: 'Test file must have exactly one root-level describe block',
            multipleRootDescribe: 'Test file must have only one root-level describe block, found {{count}}',
        },
        schema: [],
    },

    create(context) {
        const filename = context.filename;

        // Skip if not a test file
        if (!filename.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
            return {};
        }

        const rootDescribeBlocks = [];

        return {
            // Collect all CallExpression nodes
            CallExpression(node) {
                // Check if this is a describe call (including describe.skip and describe.only)
                const isDescribeCall =
                    // Direct describe() call
                    (node.callee.type === 'Identifier' && node.callee.name === 'describe') ||
                    // describe.skip() or describe.only() call
                    (node.callee.type === 'MemberExpression' &&
                        node.callee.object.type === 'Identifier' &&
                        node.callee.object.name === 'describe' &&
                        node.callee.property.type === 'Identifier' &&
                        (node.callee.property.name === 'skip' || node.callee.property.name === 'only'));

                if (isDescribeCall && node.arguments.length > 0) {
                    // Check if this is a root-level describe (not nested)
                    if (isRootLevel(node)) {
                        rootDescribeBlocks.push(node);
                    }
                }
            },

            // After traversing the entire file, validate
            'Program:exit'() {
                // Check for exactly one root describe block
                if (rootDescribeBlocks.length === 0) {
                    context.report({
                        loc: { line: 1, column: 0 },
                        messageId: 'noRootDescribe',
                    });
                    return;
                }

                if (rootDescribeBlocks.length > 1) {
                    rootDescribeBlocks.forEach((node) => {
                        context.report({
                            node,
                            messageId: 'multipleRootDescribe',
                            data: {
                                count: rootDescribeBlocks.length,
                            },
                        });
                    });
                }
            },
        };
    },
};

/**
 * Check if a node is at the root level (not nested in another describe)
 * @param {import('eslint').Rule.Node} node - AST node to check
 * @returns {boolean} True if node is at root level
 */
const isRootLevel = (node) => {
    let parent = node.parent;

    while (parent) {
        // If we find a CallExpression parent that is a describe, this is nested
        if (parent.type === 'CallExpression') {
            const isDescribeCall =
                // Direct describe() call
                (parent.callee.type === 'Identifier' && parent.callee.name === 'describe') ||
                // describe.skip() or describe.only() call
                (parent.callee.type === 'MemberExpression' &&
                    parent.callee.object.type === 'Identifier' &&
                    parent.callee.object.name === 'describe' &&
                    parent.callee.property.type === 'Identifier' &&
                    (parent.callee.property.name === 'skip' || parent.callee.property.name === 'only'));

            if (isDescribeCall) {
                return false;
            }
        }
        parent = parent.parent;
    }

    return true;
};
