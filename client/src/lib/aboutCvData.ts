import type { Language } from "./localization";

const SOFTWARE = [
  ["Ps", "Photoshop", "فوتوشوب"], ["Ai", "Illustrator", "إليستريتور"], ["Pr", "Premiere", "بريمير"], ["Ae", "After Effects", "أفتر إفكتس"],
  ["Au", "Audition", "أوديشن"], ["Cd", "CorelDRAW", "كورل درو"], ["Wd", "Word", "وورد"], ["Pp", "PowerPoint", "باوربوينت"],
] as const;

const SKILLS = [
  ["Graphic Design", "التصميم الجرافيكي"], ["Social Media Design", "تصميم السوشيال ميديا"], ["Visual Content Creation", "صناعة المحتوى البصري"], ["Photo Manipulation", "معالجة الصور"], ["Video Editing", "مونتاج الفيديو"], ["Motion Graphics", "موشن جرافيك"], ["Photo Retouching", "ريتاتش الصور"], ["Photography", "التصوير الفوتوغرافي"], ["Adobe Creative Suite", "مجموعة أدوبي كريتيف"], ["Creative Problem Solving", "حل المشكلات الإبداعي"], ["Attention to Detail", "الاهتمام بالتفاصيل"],
] as const;

const LANGUAGES = [
  ["🇪🇬", "Arabic", "العربية", "Native", "اللغة الأم", 4], ["🇬🇧", "English", "الإنجليزية", "Advanced", "متقدم", 4],
  ["🇩🇪", "German", "الألمانية", "Intermediate", "متوسط", 3], ["🇫🇷", "French", "الفرنسية", "Beginner", "مبتدئ", 2],
] as const;

const EXPERIENCE = [
  ["Graphic Design Intern", "متدرب تصميم جرافيك", "2022", "Hands-on training and real-world design experience.", "تدريب عملي وخبرة حقيقية في التصميم."],
  ["Digital Growth", "النمو الرقمي", "2023", "Developed digital content and visual materials.", "تطوير محتوى رقمي ومواد بصرية."],
  ["Photo Editing Intern", "متدرب تعديل صور", "2023", "Advanced photo manipulation and visual content production.", "معالجة متقدمة للصور وإنتاج محتوى بصري."],
  ["Freelance Graphic Designer", "مصمم جرافيك مستقل", "2024 — Present", "Working with clients on social media and brand content.", "العمل مع العملاء على السوشيال ميديا ومحتوى العلامات التجارية."],
] as const;

export function getCvData(language: Language) {
  const index = language === "ar" ? 2 : 1;
  return {
    software: SOFTWARE.map(([mark, english, arabic]) => [mark, language === "ar" ? arabic : english] as const),
    skills: SKILLS.map(([english, arabic]) => language === "ar" ? arabic : english),
    languages: LANGUAGES.map(([flag, english, arabic, levelEn, levelAr, dots]) => ({ flag, name: language === "ar" ? arabic : english, level: language === "ar" ? levelAr : levelEn, dots })),
    experience: EXPERIENCE.map(([english, arabic, date, summaryEn, summaryAr]) => ({ title: language === "ar" ? arabic : english, date: language === "ar" && date === "2024 — Present" ? "2024 — الآن" : date, summary: language === "ar" ? summaryAr : summaryEn })),
  };
}
