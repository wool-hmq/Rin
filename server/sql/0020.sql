CREATE TABLE `recovery_codes` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`code_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_codes_user_code_hash_unique` ON `recovery_codes` (`user_id`, `code_hash`);
--> statement-breakpoint
UPDATE `info` SET `value` = '20' WHERE `key` = 'migration_version';
