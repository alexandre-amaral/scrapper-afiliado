CREATE TABLE `affiliate_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`short_url` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliate_links_offer_idx` ON `affiliate_links` (`offer_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`max_per_day` integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`affiliate_link_id` integer,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`group_id` text NOT NULL,
	`scheduled_for` text,
	`sent_at` text,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`affiliate_link_id`) REFERENCES `affiliate_links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_status_idx` ON `messages` (`status`);--> statement-breakpoint
CREATE INDEX `messages_group_idx` ON `messages` (`group_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`price` real NOT NULL,
	`original_price` real,
	`discount_pct` real,
	`free_shipping` integer DEFAULT false NOT NULL,
	`image_url` text,
	`category` text,
	`seller` text,
	`source` text NOT NULL,
	`collected_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `offers_item_id_idx` ON `offers` (`item_id`);--> statement-breakpoint
CREATE INDEX `offers_collected_at_idx` ON `offers` (`collected_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job` text NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`finished_at` text,
	`ok` integer,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `runs_job_idx` ON `runs` (`job`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
