-- Current public CMS data export. Accounts and authentication records are deliberately excluded.
-- Apply after Drizzle migrations: mysql -u USER -p DATABASE < database/seed-current-content.sql

SET NAMES utf8mb4;

INSERT INTO `portfolio_content` (`key`, `value`) VALUES
  ('aboutAvailability', 'Freelance projects'),
  ('aboutFocus', 'Brand identity, social media &amp; print design'),
  ('aboutLabel', '02 / About Me'),
  ('aboutLead', 'I’m Mohamed Adel, a graphic designer who turns ideas into clear visual systems, expressive campaigns, and thoughtful printed pieces.'),
  ('aboutLocation', 'Cairo, Egypt'),
  ('aboutPointOne', 'Visual identities that feel distinctive and consistent.'),
  ('aboutPointThree', 'Print materials that turn a brand into something tangible.'),
  ('aboutPointTwo', 'Social media visuals built for attention and recognition.'),
  ('aboutTitle', 'Shaping brands with purpose.'),
  ('ar:aboutAvailability', 'مشاريع العمل الحر'),
  ('ar:aboutFocus', 'الهوية البصرية والسوشيال ميديا والمطبوعات'),
  ('ar:aboutLabel', '02 / نبذة عني'),
  ('ar:aboutLead', '<p>أنا محمد عادل، مصمم جرافيك أحوّل الأفكار إلى أنظمة بصرية واضحة وحملات معبّرة ومطبوعات مدروسة.</p>'),
  ('ar:aboutLocation', 'القاهرة، مصر'),
  ('ar:aboutPointOne', 'هويات بصرية مميزة ومتسقة.'),
  ('ar:aboutPointThree', 'مطبوعات تجعل العلامة التجارية ملموسة وحاضرة.'),
  ('ar:aboutPointTwo', 'تصميمات سوشيال ميديا مصممة لجذب الانتباه وبناء التعرّف.'),
  ('ar:aboutTitle', 'أصمم العلامات بهدف.'),
  ('ar:contactDescription', 'هل لديك هوية بصرية أو حملة أو مشروع سوشيال ميديا أو مطبوعات؟ لنبدأ محادثة بسيطة.'),
  ('ar:contactEmail', 'ma6631879@gmail.com'),
  ('ar:contactLabel', '03 / تواصل معي'),
  ('ar:contactLocation', 'القاهرة، مصر'),
  ('ar:contactResponseTime', 'خلال يومي عمل'),
  ('ar:contactTitle', 'لنصنع شيئًا مميزًا.'),
  ('ar:footerEmail', 'ma6631879@gmail.com'),
  ('ar:footerYear', '2026'),
  ('ar:homeDescription', '<p>أصمم هويات بصرية وتصميمات سوشيال ميديا ومطبوعات تمنح العلامات التجارية وضوحًا وتميّزًا وحضورًا لا يُنسى.</p>'),
  ('ar:homeEndYear', ''),
  ('ar:homeKicker', 'مرحبًا، أنا'),
  ('ar:homeName', 'محمد عادل'),
  ('ar:homeRole', 'مصمم جرافيك'),
  ('ar:homeStartYear', ''),
  ('ar:homeTitle', ''),
  ('ar:workDescription', 'أصمم هويات بصرية وأنظمة سوشيال ميديا ومطبوعات واضحة ومميزة ومصممة لتُرى.'),
  ('ar:workLabel', '01 / أعمالي'),
  ('ar:workTitle', 'مختارات أعمالي.'),
  ('contactDescription', 'Have a brand identity, campaign, social media, or print project in mind? Let’s start with a simple conversation.'),
  ('contactEmail', 'ma6631879@gmail.com'),
  ('contactLabel', '03 / Contact Me'),
  ('contactLocation', 'Cairo, Egypt'),
  ('contactResponseTime', 'Within 2 working days'),
  ('contactTitle', 'Let\'s make something.'),
  ('footerEmail', 'ma6631879@gmail.com'),
  ('footerYear', '2026'),
  ('homeDescription', 'I create visual identities, social media designs, and print materials that make brands clear, distinctive, and memorable.'),
  ('homeEndYear', ''),
  ('homeKicker', 'Hello, I\'m'),
  ('homeName', 'mohamed adel'),
  ('homeRole', 'Graphic Designer'),
  ('homeStartYear', ''),
  ('homeTitle', ''),
  ('workDescription', 'I create visual identities, social media systems, and print pieces that are clear, memorable, and designed to be seen.'),
  ('workLabel', '01 / My Work'),
  ('workTitle', 'Selected work.')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

INSERT INTO `portfolio_projects` (`id`, `title`, `titleAr`, `category`, `summary`, `summaryAr`, `imageUrl`, `projectUrl`, `sortOrder`, `isPublished`) VALUES
  (1, '.', NULL, 'Social Media', '.', NULL, '/manus-storage/portfolio/1/projects/------------------_cddeedf0.jpg', NULL, 0, 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `titleAr` = VALUES(`titleAr`), `category` = VALUES(`category`), `summary` = VALUES(`summary`), `summaryAr` = VALUES(`summaryAr`), `imageUrl` = VALUES(`imageUrl`), `projectUrl` = VALUES(`projectUrl`), `sortOrder` = VALUES(`sortOrder`), `isPublished` = VALUES(`isPublished`);

INSERT INTO `contact_links` (`id`, `label`, `labelAr`, `type`, `url`, `sortOrder`, `isPublished`) VALUES
  (1, 'phone', NULL, 'phone', 'tel:01061750542', 0, 1),
  (30001, 'whatsapp', NULL, 'whatsapp', 'https://wa.me/qr/KSEILVH4RCCHN1', 0, 1)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`), `labelAr` = VALUES(`labelAr`), `type` = VALUES(`type`), `url` = VALUES(`url`), `sortOrder` = VALUES(`sortOrder`), `isPublished` = VALUES(`isPublished`);
