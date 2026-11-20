# ClearCFO database backup runbook

This workflow exports the **Supabase Postgres database** nightly to a **private Cloudflare R2 bucket**, encrypted before upload. It does not cover Supabase Storage objects, Supabase Auth service configuration, Stripe configuration, or point-in-time recovery. Database dumps may contain customer financial and account data: never commit or attach them to PRs.

## One-time setup (owner)
1. Create a private R2 bucket (for example `clearcfo-db-backups`). Keep public access disabled.
2. Create R2 API credentials restricted to **object read/write** on that bucket. Set GitHub Actions secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.
3. Set repository variable `R2_BACKUP_BUCKET` to the bucket name.
4. In Supabase, obtain a **read-only backup connection URL if possible**; use a direct/session PostgreSQL connection compatible with `pg_dump`. Set it as GitHub secret `BACKUP_DATABASE_URL`. Do not expose the connection string in logs, issues, or chat. If the database requires privileges for a full dump, restrict the credentials and rotate after testing.
5. Generate a long random encryption passphrase locally and save it **outside GitHub** in a password manager. Set the same value as GitHub secret `BACKUP_ENCRYPTION_KEY`. **Losing this passphrase makes backups unrecoverable.**
6. In R2, configure a lifecycle rule to delete objects under `database/` after **7 days**, once the first successful backup and restoration have been verified. This is a storage setting, not part of the workflow.
7. Run `Encrypted Supabase database backup` manually from GitHub Actions. Verify the run succeeds and the encrypted object appears in R2. Scheduled runs execute at 07:17 UTC; GitHub schedules may be delayed.
8. Enable GitHub Actions failure notifications to an actively monitored email address. Periodically check for missing daily backups; GitHub Actions schedules can be disabled after prolonged repository inactivity.

## Recovery drill (do not restore into production)
1. Create an isolated disposable PostgreSQL **17** database. Do not use production.
2. Download an encrypted object from the private R2 bucket.
3. Decrypt locally using the saved passphrase:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in clearcfo-backup.dump.enc -out database.dump -pass env:BACKUP_ENCRYPTION_KEY`
4. Restore into the disposable database using a compatible `pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" database.dump`. Supabase-specific extensions, roles, and managed auth schemas may require special handling; investigate errors rather than treating a partial restore as success.
5. Check expected tables, row counts, and representative application queries **without exporting sensitive rows**. Record drill date, backup timestamp, restore result, and any gaps.
6. Delete the disposable restored data and decrypted dump securely.

## Launch gate
Do not mark backups as working until: (a) credentials and bucket configured, (b) an encrypted upload succeeds, (c) a full **test restore** succeeds, and (d) alerts/retention are confirmed. Backup scripts alone are not protection. A daily snapshot can lose up to roughly 24 hours of changes in a failure. If Supabase Storage contains customer uploads, back those up separately.
