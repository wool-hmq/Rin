-- Enforce globally unique username
-- Recreate users table with a UNIQUE constraint on username.
-- Existing duplicate usernames are made unique by appending a `#N` suffix
-- (the first occurrence keeps its original name).

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL UNIQUE,
	`openid` text NOT NULL,
	`avatar` text,
	`password` text,
	`permission` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

--> statement-breakpoint
INSERT INTO `users_new` (`id`, `username`, `openid`, `avatar`, `password`, `permission`, `created_at`, `updated_at`)
	SELECT
		`id`,
		CASE WHEN ROW_NUMBER() OVER (PARTITION BY `username` ORDER BY `id`) = 1 THEN `username`
			ELSE `username` || '#' || ROW_NUMBER() OVER (PARTITION BY `username` ORDER BY `id`) END,
		`openid`, `avatar`, `password`, `permission`, `created_at`, `updated_at`
	FROM `users`;

--> statement-breakpoint
DROP TABLE `users`;

--> statement-breakpoint
ALTER TABLE `users_new` RENAME TO `users`;

--> statement-breakpoint
UPDATE `info` SET `value` = '11' WHERE `key` = 'migration_version';
