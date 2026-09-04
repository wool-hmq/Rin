CREATE TABLE `linked_accounts` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `user_id` INTEGER NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
    `provider` TEXT NOT NULL,
    `provider_id` TEXT NOT NULL,
    `linked_at` INTEGER NOT NULL,
    UNIQUE(`user_id`, `provider`, `provider_id`)
);

CREATE UNIQUE INDEX `idx_linked_accounts_provider_id` ON `linked_accounts`(`provider`, `provider_id`);

--> statement-breakpoint

UPDATE `info` SET `value` = '13' WHERE `key` = 'migration_version';
