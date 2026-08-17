export const WORK_CATEGORIES = [
  { slug: "social-media", title: "Social Media", titleAr: "السوشيال ميديا", imageUrl: "/manus-storage/mohamed-adel-project-motion_0402e3e3.jpg" },
  { slug: "photo-manipulation", title: "Photo Manipulation", titleAr: "معالجة الصور", imageUrl: "/manus-storage/mohamed-adel-project-editorial_9fb4ebb8.jpg" },
  { slug: "book-cover", title: "Book Cover", titleAr: "غلاف كتاب", imageUrl: "/manus-storage/mohamed-adel-project-product_e59798d8.jpg" },
  { slug: "powerpoint-presentation", title: "PowerPoint Presentation", titleAr: "عروض باوربوينت", imageUrl: "/manus-storage/mohamed-adel-project-motion_0402e3e3.jpg" },
  { slug: "photo-retouching", title: "Photo Retouching", titleAr: "ريتاتش الصور", imageUrl: "/manus-storage/mohamed-adel-project-editorial_9fb4ebb8.jpg" },
  { slug: "youtube-thumbnail", title: "YouTube Thumbnail", titleAr: "صور مصغرة ليوتيوب", imageUrl: "/manus-storage/mohamed-adel-project-product_e59798d8.jpg" },
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number];
export const WORK_CATEGORY_TITLES = WORK_CATEGORIES.map(({ title }) => title);

export function getWorkCategoryBySlug(slug?: string) {
  return WORK_CATEGORIES.find((category) => category.slug === slug);
}

export function getWorkCategoryLabel(category: WorkCategory, language: "en" | "ar") {
  return language === "ar" ? category.titleAr : category.title;
}
