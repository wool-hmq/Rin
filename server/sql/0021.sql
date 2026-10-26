ALTER TABLE `api_keys` ADD `key_type` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE `api_keys` SET `key_type` = 2 WHERE `scopes` LIKE '%"content.read"%';
--> statement-breakpoint
UPDATE `info` SET `value` = '21' WHERE `key` = 'migration_version';
