CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`expire` integer DEFAULT 0 NOT NULL,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`create_time` integer NOT NULL,
	`metadata` text NOT NULL,
	`created_by` text,
	`eu_jurisdiction` integer DEFAULT 0 NOT NULL,
	`bucket_location` text DEFAULT 'global' NOT NULL,
	`invite_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_files_created_by` ON `files` (`created_by`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`inviter_id` text NOT NULL,
	`inviter_email` text NOT NULL,
	`invitee_email` text,
	`token` text NOT NULL,
	`secret_id` text,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invites_token` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invites_inviter_id` ON `invites` (`inviter_id`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`expire` integer DEFAULT 0 NOT NULL,
	`create_time` integer NOT NULL,
	`metadata` text NOT NULL,
	`created_by` text,
	`eu_jurisdiction` integer DEFAULT 0 NOT NULL,
	`invite_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_secrets_created_by` ON `secrets` (`created_by`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);