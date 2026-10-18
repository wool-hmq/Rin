CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY NOT NULL,
	`uid` integer NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_encrypted` text,
	`visible` integer DEFAULT 0 NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
--> statement-breakpoint
UPDATE `info` SET `value` = '19' WHERE `key` = 'migration_version';
