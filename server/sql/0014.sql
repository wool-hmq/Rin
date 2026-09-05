ALTER TABLE `cache` ADD COLUMN `expires_at` integer DEFAULT NULL;
CREATE INDEX `idx_cache_expires_at` ON `cache` (`expires_at`);
--> statement-breakpoint
UPDATE `info` SET `value` = '14' WHERE `key` = 'migration_version';
