CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saves` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`season_id` text NOT NULL,
	`country_id` text NOT NULL,
	`seed` integer NOT NULL,
	`tick_index` integer NOT NULL,
	`last_tick_at` integer NOT NULL,
	`status` text NOT NULL,
	`state_json` text NOT NULL,
	`ranked` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
