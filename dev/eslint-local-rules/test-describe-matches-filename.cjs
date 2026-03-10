/**
 * ESLint rule to enforce that the root describe block name matches the filename.
 * For hyphen-case filenames, the name should be prefixed with the parent folder.
 *
 * Auto-fixable.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce root describe block name matches filename convention',
            category: 'Best Practices',
            recommended: true,
        },
        fixable: 'code',
        messages: {
            mismatchedName:
                'Root describe block name "{{actual}}" must match filename "{{expected}}" (minus extension)',
        },
        schema: [],
    },

    create(context) {
        const filename = context.filename;

        // Skip if not a test file
        if (!filename.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
            return {};
        }

        // Extract the expected name from filename
        const expectedName = getExpectedDescribeName(filename);
        if (!expectedName) {
            return {};
        }

        return {
            // Check CallExpression nodes
            CallExpression(node) {
                // Check if this is a describe call (including describe.skip and describe.only) at root level
                const isDescribeCall =
                    // Direct describe() call
                    (node.callee.type === 'Identifier' && node.callee.name === 'describe') ||
                    // describe.skip() or describe.only() call
                    (node.callee.type === 'MemberExpression' &&
                        node.callee.object.type === 'Identifier' &&
                        node.callee.object.name === 'describe' &&
                        node.callee.property.type === 'Identifier' &&
                        (node.callee.property.name === 'skip' || node.callee.property.name === 'only'));

                if (isDescribeCall && node.arguments.length > 0 && isRootLevel(node)) {
                    const firstArg = node.arguments[0];

                    if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
                        const actualName = firstArg.value;
                        if (actualName !== expectedName) {
                            context.report({
                                node: firstArg,
                                messageId: 'mismatchedName',
                                data: {
                                    actual: actualName,
                                    expected: expectedName,
                                },
                                fix(fixer) {
                                    // Auto-fix by replacing the string literal
                                    return fixer.replaceText(firstArg, `'${expectedName}'`);
                                },
                            });
                        }
                    }
                }
            },
        };
    },
};

/**
 * Extract the expected describe name from the filename
 * @param {string} filename - Full file path
 * @returns {string|null} Expected describe name or null if not a test file
 */
const getExpectedDescribeName = (filename) => {
    const path = require('path');
    const basename = path.basename(filename);
    const dirname = path.basename(path.dirname(filename));

    // Check if this is an integration test
    const isIntegrationTest = /\.integration\.test\.(ts|tsx|js|jsx)$/.test(basename);

    // Check if this is a snapshot test
    const isSnapshotTest = /\.snapshot\.test\.(ts|tsx|js|jsx)$/.test(basename);

    // Remove various test extensions
    const nameWithoutExt = basename
        .replace(/\.integration\.test\.(ts|tsx|js|jsx)$/, '')
        .replace(/\.snapshot\.test\.(ts|tsx|js|jsx)$/, '')
        .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '');

    if (!nameWithoutExt) {
        return null;
    }

    // Check if the filename is hyphen-case or all lowercase (no capital letters)
    const isHyphenCase = /^[a-z0-9-]+$/.test(nameWithoutExt);

    let expectedName = nameWithoutExt;

    // If hyphen-case or all lowercase, prefix with parent folder
    if (isHyphenCase && dirname) {
        expectedName = `${dirname} ${nameWithoutExt}`;
    }

    // Integration tests should have " integration" suffix
    if (isIntegrationTest) {
        return `${expectedName} integration`;
    }

    // Snapshot tests should have " snapshots" suffix
    if (isSnapshotTest) {
        return `${expectedName} snapshots`;
    }

    return expectedName;
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
