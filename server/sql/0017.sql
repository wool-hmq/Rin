ALTER TABLE `friends` ADD COLUMN `group` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '17' WHERE `key` = 'migration_version';