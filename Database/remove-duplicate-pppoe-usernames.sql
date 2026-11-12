-- =====================================================================
-- REMOVE DUPLICATE PPPoE USERNAMES (keep the LATEST record)
--
-- Run on: UatDatabase  (NOT on the live database)
-- Take a backup first:
--   pg_dump -U postgres -h localhost -F c -f UatDatabase-backup.backup UatDatabase
--
-- What it does (all in ONE transaction - if anything fails nothing changes):
--   1. For every PPPoE username that appears more than once (case-insensitive),
--      keeps the newest subscriber (latest CreatedAt, then UpdatedAt).
--   2. Moves the history of the older copies (recharges, sessions, auth logs,
--      wallet transactions, CAF forms/documents, emails, SMS) to the kept record,
--      so nothing is lost.
--   3. Copies the deleted rows into the table "Subscribers_DuplicatesBackup".
--   4. Deletes the older copies.
--
-- After this, run the migration again (Update-Database or uat-upgrade.sql).
-- =====================================================================

BEGIN;

-- 1. Which record to keep and which to remove ---------------------------------
CREATE TEMP TABLE dup_map ON COMMIT DROP AS
SELECT ranked."Id"      AS remove_id,
       ranked.keep_id   AS keep_id,
       ranked."PPPoEUsername"
FROM (
    SELECT s."Id",
           s."PPPoEUsername",
           FIRST_VALUE(s."Id") OVER w AS keep_id,
           ROW_NUMBER()        OVER w AS rn
    FROM "Subscribers" s
    WHERE BTRIM(s."PPPoEUsername") <> ''
    WINDOW w AS (
        PARTITION BY LOWER(BTRIM(s."PPPoEUsername"))
        ORDER BY s."CreatedAt" DESC, s."UpdatedAt" DESC, s."Id" DESC
    )
) ranked
WHERE ranked.rn > 1;

-- Show what will be removed (visible in pgAdmin "Messages"/output)
SELECT d."PPPoEUsername", d.remove_id, d.keep_id FROM dup_map d ORDER BY 1;

-- 2. Backup of the rows that will be deleted ------------------------------------
CREATE TABLE IF NOT EXISTS "Subscribers_DuplicatesBackup" AS
SELECT s.*, NOW() AS "BackupAt", NULL::uuid AS "KeptSubscriberId"
FROM "Subscribers" s WHERE FALSE;

INSERT INTO "Subscribers_DuplicatesBackup"
SELECT s.*, NOW(), d.keep_id
FROM "Subscribers" s
JOIN dup_map d ON d.remove_id = s."Id";

-- 3. Move related records to the kept subscriber ---------------------------------
-- Old package rows must not stay "current" next to the kept record's package
UPDATE "SubscriberPackageHistories" h
SET "SubscriberId" = d.keep_id, "IsCurrent" = FALSE
FROM dup_map d WHERE h."SubscriberId" = d.remove_id;

UPDATE "RadiusAccountingSessions" r SET "SubscriberId" = d.keep_id
FROM dup_map d WHERE r."SubscriberId" = d.remove_id;

UPDATE "RadiusAuthenticationLogs" l SET "SubscriberId" = d.keep_id
FROM dup_map d WHERE l."SubscriberId" = d.remove_id;

UPDATE "WalletTransactions" w SET "SubscriberId" = d.keep_id
FROM dup_map d WHERE w."SubscriberId" = d.remove_id;

UPDATE "CustomerApplicationForms" c SET "SubscriberId" = d.keep_id
FROM dup_map d WHERE c."SubscriberId" = d.remove_id;

UPDATE "CAFDocuments" c SET "SubscriberId" = d.keep_id
FROM dup_map d WHERE c."SubscriberId" = d.remove_id;

UPDATE "EmailLogs" e SET "SubscriberId" = d.keep_id
FROM dup_map d WHERE e."SubscriberId" = d.remove_id;

-- SmsLogs exists only after the first new migration has run
DO $$
BEGIN
    IF to_regclass('"SmsLogs"') IS NOT NULL THEN
        UPDATE "SmsLogs" l SET "SubscriberId" = d.keep_id
        FROM dup_map d WHERE l."SubscriberId" = d.remove_id;
    END IF;
END $$;

-- 4. Delete the older copies ------------------------------------------------------
DELETE FROM "Subscribers" s
USING dup_map d
WHERE s."Id" = d.remove_id;

-- 5. Check: this must return 0 rows -----------------------------------------------
SELECT LOWER(BTRIM("PPPoEUsername")) AS username, COUNT(*)
FROM "Subscribers"
WHERE BTRIM("PPPoEUsername") <> ''
GROUP BY 1
HAVING COUNT(*) > 1;

COMMIT;
