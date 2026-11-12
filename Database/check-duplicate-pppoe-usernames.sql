-- =====================================================================
-- Find subscribers that share the same PPPoE username (case-insensitive).
-- Run this in pgAdmin on UatDatabase BEFORE "dotnet ef database update"
-- if the UniquePppoeUsername migration reports duplicates.
-- =====================================================================

SELECT LOWER(s."PPPoEUsername")      AS username,
       s."Id",
       s."FullName",
       s."Mobile",
       st."SiteName",
       s."ExpireDate",
       s."CreatedAt",
       s."UpdatedAt"
FROM "Subscribers" s
LEFT JOIN "Sites" st ON st."Id" = s."SiteId"
WHERE LOWER(s."PPPoEUsername") IN (
    SELECT LOWER("PPPoEUsername")
    FROM "Subscribers"
    WHERE "PPPoEUsername" <> ''
    GROUP BY LOWER("PPPoEUsername")
    HAVING COUNT(*) > 1
)
ORDER BY 1, s."CreatedAt";

-- ---------------------------------------------------------------------
-- How to fix (choose one per duplicate, after checking the rows above):
--
--  a) Wrong / test entry -> delete it from the panel (Subscribers > Delete)
--
--  b) Two real customers -> rename one of them, e.g.
--     UPDATE "Subscribers" SET "PPPoEUsername" = 'newname'
--     WHERE "Id" = '<id of the subscriber to rename>';
--     (and change the username in the customer's router too)
-- ---------------------------------------------------------------------
