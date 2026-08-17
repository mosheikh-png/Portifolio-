export const CONTACT_LINK_TYPES = ["phone", "whatsapp", "instagram", "linkedin", "behance", "facebook", "x", "website", "other"] as const;

export type ContactLinkType = (typeof CONTACT_LINK_TYPES)[number];

export const CONTACT_LINK_LABELS: Record<ContactLinkType, { en: string; ar: string }> = {
  phone: { en: "Phone", ar: "هاتف" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  instagram: { en: "Instagram", ar: "إنستجرام" },
  linkedin: { en: "LinkedIn", ar: "لينكدإن" },
  behance: { en: "Behance", ar: "بيهانس" },
  facebook: { en: "Facebook", ar: "فيسبوك" },
  x: { en: "X", ar: "إكس" },
  website: { en: "Website", ar: "موقع إلكتروني" },
  other: { en: "Link", ar: "رابط" },
};

export function getContactLinkLabel(type: ContactLinkType, language: "en" | "ar", customLabel?: string | null) {
  return customLabel || CONTACT_LINK_LABELS[type][language];
}
