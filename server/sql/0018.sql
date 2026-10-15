ALTER TABLE `users` ADD COLUMN `totp_secret` text;
--> statement-breakpoint
UPDATE `info` SET `value` = '18' WHERE `key` = 'migration_version';