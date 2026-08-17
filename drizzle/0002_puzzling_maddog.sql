CREATE TABLE `contact_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(100) NOT NULL,
	`labelAr` varchar(100),
	`type` enum('phone','whatsapp','instagram','linkedin','behance','facebook','x','website','other') NOT NULL,
	`url` varchar(1024) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_links_id` PRIMARY KEY(`id`)
);
