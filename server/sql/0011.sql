-- Enforce a globally unique username without recreating the table.
-- Recreating via DROP TABLE + RENAME triggers D1_RESET_DO in non-interactive
-- wrangler, which refuses the migration. Instead we dedupe in place and add a
-- unique index. OAuth (GitHub/Gitee) usernames never contain '#', so suffixing
-- a duplicate with '#N' cannot collide with any existing username.

--> statement-breakpoint
WITH `ranked` AS (
	SELECT
		`id`,
		CASE WHEN ROW_NUMBER() OVER (PARTITION BY `username` ORDER BY `id`) > 1
			THEN `username` || '#' || ROW_NUMBER() OVER (PARTITION BY `username` ORDER BY `id`)
			ELSE `username` END AS `new_username`
	FROM `users`
)
UPDATE `users` SET `username` = (
	SELECT `new_username` FROM `ranked` WHERE `ranked`.`id` = `users`.`id`
)
WHERE `id` IN (SELECT `id` FROM `ranked` WHERE `new_username` <> `username`);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);

--> statement-breakpoint
UPDATE `info` SET `value` = '11' WHERE `key` = 'migration_version';
