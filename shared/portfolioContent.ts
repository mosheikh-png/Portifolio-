export const CONTENT_DEFAULTS = {
  homeKicker: "Hello, I'm",
  homeTitle: "portfolio",
  homeName: "mohamed adel",
  homeRole: "Graphic Designer",
  homeDescription: "I create visual identities, social media designs, and print materials that make brands clear, distinctive, and memorable.",
  homeStartYear: "2024",
  homeEndYear: "2026",
  footerEmail: "hello@mohamedadel.com",
  footerYear: "2026",
  aboutLabel: "02 / About Me",
  aboutTitle: "Shaping brands with purpose.",
  aboutLead: "I’m Mohamed Adel, a graphic designer who turns ideas into clear visual systems, expressive campaigns, and thoughtful printed pieces.",
  aboutPointOne: "Visual identities that feel distinctive and consistent.",
  aboutPointTwo: "Social media visuals built for attention and recognition.",
  aboutPointThree: "Print materials that turn a brand into something tangible.",
  aboutFocus: "Brand identity, social media & print design",
  aboutLocation: "Cairo, Egypt",
  aboutAvailability: "Freelance projects",
  contactLabel: "03 / Contact Me",
  contactTitle: "Let's make something.",
  contactDescription: "Have a brand identity, campaign, social media, or print project in mind? Let’s start with a simple conversation.",
  contactEmail: "hello@mohamedadel.com",
  contactResponseTime: "Within 2 working days",
  contactLocation: "Cairo, Egypt",
  workLabel: "01 / My Work",
  workTitle: "Selected work.",
  workDescription: "I create visual identities, social media systems, and print pieces that are clear, memorable, and designed to be seen.",
} as const;

export const ARABIC_CONTENT_DEFAULTS = {
  homeKicker: "مرحبًا، أنا",
  homeTitle: "بورتفوليو",
  homeName: "محمد عادل",
  homeRole: "مصمم جرافيك",
  homeDescription: "أصمم هويات بصرية وتصميمات سوشيال ميديا ومطبوعات تمنح العلامات التجارية وضوحًا وتميّزًا وحضورًا لا يُنسى.",
  homeStartYear: "2024",
  homeEndYear: "2026",
  footerEmail: "hello@mohamedadel.com",
  footerYear: "2026",
  aboutLabel: "02 / نبذة عني",
  aboutTitle: "أصمم العلامات بهدف.",
  aboutLead: "أنا محمد عادل، مصمم جرافيك أحوّل الأفكار إلى أنظمة بصرية واضحة وحملات معبّرة ومطبوعات مدروسة.",
  aboutPointOne: "هويات بصرية مميزة ومتسقة.",
  aboutPointTwo: "تصميمات سوشيال ميديا مصممة لجذب الانتباه وبناء التعرّف.",
  aboutPointThree: "مطبوعات تجعل العلامة التجارية ملموسة وحاضرة.",
  aboutFocus: "الهوية البصرية والسوشيال ميديا والمطبوعات",
  aboutLocation: "القاهرة، مصر",
  aboutAvailability: "مشاريع العمل الحر",
  contactLabel: "03 / تواصل معي",
  contactTitle: "لنصنع شيئًا مميزًا.",
  contactDescription: "هل لديك هوية بصرية أو حملة أو مشروع سوشيال ميديا أو مطبوعات؟ لنبدأ محادثة بسيطة.",
  contactEmail: "hello@mohamedadel.com",
  contactResponseTime: "خلال يومي عمل",
  contactLocation: "القاهرة، مصر",
  workLabel: "01 / أعمالي",
  workTitle: "مختارات أعمالي.",
  workDescription: "أصمم هويات بصرية وأنظمة سوشيال ميديا ومطبوعات واضحة ومميزة ومصممة لتُرى.",
} as const satisfies Record<keyof typeof CONTENT_DEFAULTS, string>;

export type ContentKey = keyof typeof CONTENT_DEFAULTS;
export type ContentLanguage = "en" | "ar";
export type ContentValues = Record<ContentKey, string>;

export function getStoredContentKey(key: ContentKey, language: ContentLanguage) {
  return language === "ar" ? `ar:${key}` : key;
}

export function mergePortfolioContent(
  items?: Array<{ key: string; value: string }>,
  language: ContentLanguage = "en",
): ContentValues {
  const values: Record<string, string> = {
    ...(language === "ar" ? ARABIC_CONTENT_DEFAULTS : CONTENT_DEFAULTS),
  };

  items?.forEach((item) => {
    const contentKey = language === "ar" ? item.key.replace(/^ar:/, "") : item.key;
    const isMatchingLanguage = language === "ar" ? item.key.startsWith("ar:") : !item.key.startsWith("ar:");
    if (isMatchingLanguage && contentKey in values) values[contentKey] = item.value;
  });

  return values as ContentValues;
}
