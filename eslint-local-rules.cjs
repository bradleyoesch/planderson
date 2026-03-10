/**
 * Custom local ESLint rules — required at project root by eslint-plugin-local-rules.
 * To add a rule: create dev/eslint-local-rules/<name>.cjs, add it here, enable it in eslint.config.js.
 */
module.exports = {
    'test-single-describe': require('./dev/eslint-local-rules/test-single-describe.cjs'),
    'test-describe-matches-filename': require('./dev/eslint-local-rules/test-describe-matches-filename.cjs'),
};
