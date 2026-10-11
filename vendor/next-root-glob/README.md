# Next lint project directory adapter

This local package replaces `fast-glob` only underneath `@next/eslint-plugin-next`.
It removes the `fast-glob -> micromatch -> braces` dependency chain affected by
GHSA-vfj7-8cjw-p6xm, for which braces 3.0.3 has no published fix.

Next 16.3.4 uses only `globSync(pattern, { onlyDirectories: true })` in
`dist/utils/get-root-dirs.js`. This adapter uses the existing lint stack's
`tinyglobby` 0.2.17 and preserves fast-glob's literal-directory and absolute-path
behavior. It is not intended to replace the entire fast-glob API.

The npm override's relative file path is resolved from the parent Next plugin
package. The lockfile records a portable link to `vendor/next-root-glob`.
`test:lint-dependencies` executes the installed Next utility against fixtures,
and CI retains `npm audit --audit-level=high` over all dependencies.

Recheck the API usage on any Next lint plugin upgrade and remove the override
when upstream no longer depends on the vulnerable chain.
