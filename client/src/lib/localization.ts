export type Language = "en" | "ar";

export const UI_COPY = {
  en: {
    home: "Home", work: "My Work", about: "About", contact: "Contact", letsTalk: "Let's Talk",
    myWork: "My Work", aboutMe: "About Me", contactMe: "Contact Me", portfolioNavigation: "Portfolio page navigation",
    exploreCategory: "Explore category", moreProjects: "More visual projects coming soon.", graphicDesigner: "Graphic Designer",
    responseTime: "Response time", basedIn: "Based in", availableProjects: "Available for selected projects.",
    software: "Software", skills: "Skills", languages: "Languages", experience: "Work Experience", curriculumVitae: "Curriculum Vitae",
    requestCv: "Request My CV", requestCvDetail: "Get the full résumé by email", focus: "Focus", availableFor: "Available for",
    allCategories: "All categories", categoryMissing: "Category not found.", categoryMissingDetail: "Choose a valid portfolio category from the My Work page.",
    noProjects: "No projects here yet.", noProjectsDetail: "This category is ready for your work. Add published projects from the private dashboard and they will appear here automatically.",
  },
  ar: {
    home: "الرئيسية", work: "أعمالي", about: "نبذة", contact: "تواصل", letsTalk: "تواصل معي",
    myWork: "أعمالي", aboutMe: "نبذة عني", contactMe: "تواصل معي", portfolioNavigation: "التنقل بين صفحات البورتفوليو",
    exploreCategory: "استكشف القسم", moreProjects: "المزيد من المشاريع البصرية قريبًا.", graphicDesigner: "مصمم جرافيك",
    responseTime: "وقت الرد", basedIn: "الموقع", availableProjects: "متاح لمشاريع مختارة.",
    software: "البرامج", skills: "المهارات", languages: "اللغات", experience: "الخبرة العملية", curriculumVitae: "السيرة الذاتية",
    requestCv: "اطلب سيرتي الذاتية", requestCvDetail: "احصل على السيرة الكاملة عبر البريد", focus: "التخصص", availableFor: "متاح لـ",
    allCategories: "كل الأقسام", categoryMissing: "القسم غير موجود.", categoryMissingDetail: "اختر قسمًا صحيحًا من صفحة الأعمال.",
    noProjects: "لا توجد مشاريع هنا بعد.", noProjectsDetail: "هذا القسم جاهز لأعمالك. أضف مشاريع منشورة من لوحة التحكم وستظهر هنا تلقائيًا.",
  },
} as const;

export type CopyKey = keyof typeof UI_COPY.en;
