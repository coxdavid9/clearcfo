// Scoped to @next/eslint-plugin-next's get-root-dirs utility, which only calls
// globSync(pattern, { onlyDirectories: true }). This is not a full fast-glob shim.
// tinyglobby otherwise expands a literal directory into its descendants.
const { globSync } = require('tinyglobby');
const { isAbsolute } = require('node:path');
exports.globSync = (patterns, options = {}) => globSync(patterns, {
  ...options,
  expandDirectories: false,
  absolute: options.absolute ?? (typeof patterns === 'string' && isAbsolute(patterns)),
});
