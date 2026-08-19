import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import RichTextEditor from "@/components/RichTextEditor";
import { trpc } from "@/lib/trpc";
import { mergePortfolioContent } from "@/lib/portfolioContent";
import { WORK_CATEGORY_TITLES } from "@/lib/workCategories";
import { CONTACT_LINK_LABELS, CONTACT_LINK_TYPES, type ContactLinkType } from "@shared/contactLinks";
import { ARABIC_CONTENT_DEFAULTS, CONTENT_DEFAULTS, type ContentKey, type ContentLanguage } from "@shared/portfolioContent";
import { ExternalLink, ImagePlus, Link2, Loader2, Pencil, Plus, Save, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useSound } from "@/contexts/SoundContext";

type ProjectForm = {
  id?: number;
  title: string;
  titleAr: string;
  category: string;
  summary: string;
  summaryAr: string;
  imageUrl: string;
  projectUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

const EMPTY_PROJECT: ProjectForm = {
  title: "",
  titleAr: "",
  category: "Social Media",
  summary: "",
  summaryAr: "",
  imageUrl: "",
  projectUrl: "",
  sortOrder: 0,
  isPublished: true,
};
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

type ContactLinkForm = {
  id?: number;
  label: string;
  labelAr: string;
  type: ContactLinkType;
  url: string;
  sortOrder: number;
  isPublished: boolean;
};

const EMPTY_CONTACT_LINK: ContactLinkForm = {
  label: "",
  labelAr: "",
  type: "phone",
  url: "",
  sortOrder: 0,
  isPublished: true,
};

const contentGroups = [
  {
    title: "الصفحة الرئيسية",
    fields: [
      ["homeKicker", "السطر الصغير فوق العنوان"],
      ["homeTitle", "عنوان Portfolio"],
      ["homeName", "الاسم الرئيسي"],
      ["homeRole", "المسمى الوظيفي"],
      ["homeDescription", "الوصف المختصر"],
      ["homeStartYear", "سنة البداية"],
      ["homeEndYear", "سنة النهاية"],
    ],
  },
  {
    title: "النبذة",
    fields: [
      ["aboutTitle", "عنوان صفحة About"],
      ["aboutLead", "النبذة"],
      ["aboutPointOne", "نقطة قوة 1"],
      ["aboutPointTwo", "نقطة قوة 2"],
      ["aboutPointThree", "نقطة قوة 3"],
      ["aboutFocus", "مجال التركيز"],
      ["aboutLocation", "الموقع"],
      ["aboutAvailability", "حالة التوفر"],
    ],
  },
  {
    title: "التواصل",
    fields: [
      ["contactTitle", "عنوان صفحة Contact"],
      ["contactDescription", "رسالة التواصل"],
      ["contactEmail", "البريد الإلكتروني"],
      ["contactResponseTime", "مدة الرد"],
      ["contactLocation", "الموقع"],
      ["footerEmail", "بريد الفوتر"],
      ["footerYear", "سنة حقوق النشر"],
    ],
  },
] as const;

const RICH_TEXT_KEYS: ContentKey[] = ["homeDescription", "aboutLead", "contactDescription", "workDescription"];

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  const className = "mt-2 w-full rounded-xl border border-cyan-100/15 bg-[#071c21] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15";
  return <label className="block text-sm font-medium text-slate-300">{label}{multiline ? <textarea dir="auto" className={`${className} min-h-24 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} /> : <input dir="auto" className={className} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function ContentEditor() {
  const utils = trpc.useUtils();
  const { play } = useSound();
  const { data, isLoading } = trpc.cms.adminContent.useQuery();
  const [values, setValues] = useState<Record<ContentKey, string>>({ ...CONTENT_DEFAULTS });
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>("ar");
  const update = trpc.cms.updateContent.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.cms.publicContent.invalidate(), utils.cms.adminContent.invalidate()]);
      play("success");
      toast.success("تم حفظ المحتوى ونشره على الموقع.");
    },
    onError: (error) => { play("error"); toast.error(error.message); },
  });

  useEffect(() => {
    if (data) setValues(mergePortfolioContent(data, contentLanguage));
  }, [contentLanguage, data]);

  if (isLoading) return <div className="grid min-h-80 place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div>;

  const save = () => update.mutate({ language: contentLanguage, items: (Object.entries(values) as Array<[ContentKey, string]>).map(([key, value]) => ({ key, value })) });
  const languageLabel = contentLanguage === "ar" ? "العربية" : "English";
  const defaults = contentLanguage === "ar" ? ARABIC_CONTENT_DEFAULTS : CONTENT_DEFAULTS;

  return <section className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Content Studio</p><h1 className="mt-2 font-serif text-4xl text-white">تعديل النصوص والبيانات</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">اختر اللغة، ثم نسّق الفقرات والوصف من المحرر الغني. يتم حفظ HTML الآمن فقط ونشره مباشرة.</p></div><div className="inline-flex rounded-xl border border-white/10 bg-black/10 p-1" role="group" aria-label="لغة المحتوى"><button type="button" onClick={() => setContentLanguage("ar")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${contentLanguage === "ar" ? "bg-cyan-300 text-[#042027]" : "text-slate-300 hover:bg-white/10"}`}>العربية</button><button type="button" onClick={() => setContentLanguage("en")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${contentLanguage === "en" ? "bg-cyan-300 text-[#042027]" : "text-slate-300 hover:bg-white/10"}`}>English</button></div></div><div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/5 px-4 py-3 text-sm leading-6 text-cyan-50" dir={contentLanguage === "ar" ? "rtl" : "ltr"}>أنت الآن تعدّل محتوى <strong>{languageLabel}</strong>. أدوات التنسيق متاحة للوصف والنبذة ورسالة التواصل، بينما تبقى العناوين والبيانات المختصرة نصوصًا مباشرة للحفاظ على التصميم.</div><div className="grid gap-5 xl:grid-cols-3">{contentGroups.map((group) => <article key={group.title} className="rounded-3xl border border-white/10 bg-[#08262b]/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,.16)]" dir={contentLanguage === "ar" ? "rtl" : "ltr"}><h2 className="text-lg font-semibold text-white">{group.title}</h2><div className="mt-5 space-y-4">{group.fields.map(([key, label]) => RICH_TEXT_KEYS.includes(key) ? <RichTextEditor key={key} label={label} value={values[key] ?? defaults[key]} dir={contentLanguage === "ar" ? "rtl" : "ltr"} onChange={(value) => setValues((current) => ({ ...current, [key]: value }))} /> : <Field key={key} label={label} value={values[key] ?? defaults[key]} onChange={(value) => setValues((current) => ({ ...current, [key]: value }))} />)}</div></article>)}</div><div className="static flex justify-stretch md:sticky md:bottom-4 md:justify-end"><button onClick={save} disabled={update.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#042027] shadow-lg transition hover:bg-cyan-200 disabled:opacity-60 md:w-auto"><Save size={17} />{update.isPending ? "جارٍ الحفظ..." : `حفظ ونشر تعديلات ${languageLabel}`}</button></div></section>;
}

function ProjectsEditor() {
  const utils = trpc.useUtils();
  const { play } = useSound();
  const { data: projects, isLoading } = trpc.cms.adminProjects.useQuery();
  const [form, setForm] = useState<ProjectForm>(EMPTY_PROJECT);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const upload = trpc.cms.uploadProjectImage.useMutation({ onError: (error) => { play("error"); toast.error(error.message); } });
  const invalidate = () => Promise.all([utils.cms.adminProjects.invalidate(), utils.cms.publicProjects.invalidate()]);
  const create = trpc.cms.createProject.useMutation({ onSuccess: async () => { await invalidate(); play("success"); toast.success("تمت إضافة المشروع."); setForm(EMPTY_PROJECT); setIsFormOpen(false); }, onError: (error) => { play("error"); toast.error(error.message); } });
  const update = trpc.cms.updateProject.useMutation({ onSuccess: async () => { await invalidate(); play("success"); toast.success("تم تحديث المشروع."); setForm(EMPTY_PROJECT); setIsFormOpen(false); }, onError: (error) => { play("error"); toast.error(error.message); } });
  const remove = trpc.cms.deleteProject.useMutation({ onSuccess: invalidate, onError: (error) => { play("error"); toast.error(error.message); } });

  const save = () => {
    if (!form.title.trim() || !form.category.trim() || !form.summary.trim() || !form.imageUrl.trim()) return toast.error("أدخل عنوان المشروع ونوعه والوصف والصورة أولًا.");
    const payload = { title: form.title.trim(), titleAr: form.titleAr.trim() || null, category: form.category, summary: form.summary.trim(), summaryAr: form.summaryAr.trim() || null, imageUrl: form.imageUrl.trim(), projectUrl: form.projectUrl.trim() || null, sortOrder: Number(form.sortOrder) || 0, isPublished: form.isPublished };
    if (form.id) update.mutate({ id: form.id, ...payload }); else create.mutate(payload);
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const contentType = file.type as SupportedImageType;
    if (!SUPPORTED_IMAGE_TYPES.includes(contentType)) return toast.error("اختر صورة بصيغة PNG أو JPEG أو WebP أو GIF.");
    if (file.size > 8 * 1024 * 1024) return toast.error("أقصى حجم للصورة هو 8MB.");
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ filename: file.name, contentType, dataUrl: String(reader.result) }, { onSuccess: (result) => { setForm((current) => ({ ...current, imageUrl: result.url })); play("success"); toast.success("تم رفع الصورة."); } });
    reader.readAsDataURL(file);
  };

  if (isLoading) return <div className="grid min-h-80 place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div>;
  const categoryOptions = Array.from(new Set([...WORK_CATEGORY_TITLES, form.category].filter(Boolean)));
  return <section className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Graphic Project Library</p><h1 className="mt-2 font-serif text-4xl text-white">إدارة المشاريع</h1><p className="mt-2 text-sm text-slate-400">أضف مشاريع جديدة أو حدّثها أو أخفها من صفحة الأعمال العامة.</p></div><button onClick={() => { setForm(EMPTY_PROJECT); setIsFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#042027] transition hover:bg-cyan-200"><Plus size={17} />مشروع جديد</button></div>{isFormOpen && <article className="rounded-3xl border border-cyan-200/20 bg-[#08262b] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{form.id ? "تعديل المشروع" : "إضافة مشروع"}</h2><button onClick={() => setIsFormOpen(false)} className="text-sm text-slate-400 hover:text-white">إلغاء</button></div><div className="grid gap-4 md:grid-cols-2"><Field label="عنوان المشروع — English" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} /><Field label="عنوان المشروع — العربية (اختياري)" value={form.titleAr} onChange={(value) => setForm((current) => ({ ...current, titleAr: value }))} /><label className="block text-sm font-medium text-slate-300">التصنيف<select className="mt-2 w-full rounded-xl border border-cyan-100/15 bg-[#071c21] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><Field label="رابط المشروع (اختياري)" value={form.projectUrl} onChange={(value) => setForm((current) => ({ ...current, projectUrl: value }))} /><Field label="ترتيب الظهور" value={String(form.sortOrder)} onChange={(value) => setForm((current) => ({ ...current, sortOrder: Number(value) || 0 }))} /><div className="md:col-span-2 grid gap-4 md:grid-cols-2"><Field label="وصف المشروع — English" value={form.summary} multiline onChange={(value) => setForm((current) => ({ ...current, summary: value }))} /><Field label="وصف المشروع — العربية (اختياري)" value={form.summaryAr} multiline onChange={(value) => setForm((current) => ({ ...current, summaryAr: value }))} /></div><div className="md:col-span-2 rounded-2xl border border-dashed border-cyan-100/20 bg-black/10 p-4"><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-200/20 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-100/10"><Upload size={16} />رفع صورة<input className="hidden" type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0])} /></label>{upload.isPending && <span className="text-sm text-cyan-200">جارٍ رفع الصورة...</span>}{form.imageUrl && <img src={form.imageUrl} alt="معاينة المشروع" className="h-16 w-24 rounded-lg object-cover" loading="lazy" decoding="async" />}<span className="text-xs text-slate-500">أو الصق رابط الصورة في الحقل التالي.</span></div><input className="mt-3 w-full rounded-lg border border-white/10 bg-[#071c21] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/60" placeholder="رابط صورة المشروع" value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} /></div><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))} />إظهار المشروع في صفحة الأعمال</label></div><button onClick={save} disabled={create.isPending || update.isPending || upload.isPending} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#042027] disabled:opacity-60"><Save size={17} />حفظ المشروع</button></article>}<div className="grid gap-4 lg:grid-cols-2">{projects?.map((project) => <article key={project.id} className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#08262b]/85"><img src={project.imageUrl} alt="" className="h-36 w-32 object-cover" loading="lazy" decoding="async" /><div className="min-w-0 flex-1 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.13em] text-cyan-300">{project.category}</p><h2 className="mt-1 truncate text-lg font-semibold text-white">{project.title}</h2></div><span className={`rounded-full px-2 py-1 text-xs ${project.isPublished ? "bg-cyan-300/15 text-cyan-200" : "bg-white/10 text-slate-400"}`}>{project.isPublished ? "منشور" : "مخفي"}</span></div><p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{project.summary}</p><div className="mt-3 flex gap-2"><button onClick={() => { setForm({ id: project.id, title: project.title, titleAr: project.titleAr ?? "", category: project.category, summary: project.summary, summaryAr: project.summaryAr ?? "", imageUrl: project.imageUrl, projectUrl: project.projectUrl ?? "", sortOrder: project.sortOrder, isPublished: project.isPublished }); setIsFormOpen(true); }} className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100"><Pencil size={14} />تعديل</button><button onClick={() => { if (window.confirm(`حذف ${project.title}؟`)) remove.mutate({ id: project.id }); }} className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"><Trash2 size={14} />حذف</button>{project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"><ExternalLink size={14} />فتح</a>}</div></div></article>)}</div>{!projects?.length && <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400"><ImagePlus className="mx-auto mb-3 text-cyan-300" /><p>لا توجد مشاريع مضافة بعد. ابدأ بإضافة مشروعك الأول.</p></div>}</section>;
}

function ContactLinksEditor() {
  const utils = trpc.useUtils();
  const { play } = useSound();
  const { data: links, isLoading } = trpc.cms.adminContactLinks.useQuery();
  const [form, setForm] = useState<ContactLinkForm>(EMPTY_CONTACT_LINK);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const invalidate = () => Promise.all([utils.cms.adminContactLinks.invalidate(), utils.cms.publicContactLinks.invalidate()]);
  const create = trpc.cms.createContactLink.useMutation({ onSuccess: async () => { await invalidate(); play("success"); toast.success("تمت إضافة وسيلة التواصل."); setForm(EMPTY_CONTACT_LINK); setIsFormOpen(false); }, onError: (error) => { play("error"); toast.error(error.message); } });
  const update = trpc.cms.updateContactLink.useMutation({ onSuccess: async () => { await invalidate(); play("success"); toast.success("تم تحديث وسيلة التواصل."); setForm(EMPTY_CONTACT_LINK); setIsFormOpen(false); }, onError: (error) => { play("error"); toast.error(error.message); } });
  const remove = trpc.cms.deleteContactLink.useMutation({ onSuccess: async () => { await invalidate(); play("success"); toast.success("تم حذف وسيلة التواصل."); }, onError: (error) => { play("error"); toast.error(error.message); } });

  const save = () => {
    if (!form.label.trim() || !form.url.trim()) return toast.error("أدخل الاسم والرابط أو الرقم أولًا.");
    const normalizedUrl = form.type === "phone" && !form.url.trim().startsWith("tel:") ? `tel:${form.url.trim()}` : form.url.trim();
    const payload = { label: form.label.trim(), labelAr: form.labelAr.trim() || null, type: form.type, url: normalizedUrl, sortOrder: Number(form.sortOrder) || 0, isPublished: form.isPublished };
    if (form.id) update.mutate({ id: form.id, ...payload }); else create.mutate(payload);
  };

  if (isLoading) return <div className="grid min-h-80 place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div>;

  return <section className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Contact Directory</p><h1 className="mt-2 font-serif text-4xl text-white">روابط وأرقام التواصل</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">أضف هاتفك وواتساب وروابط حساباتك. ستظهر فقط القنوات المنشورة في صفحة التواصل.</p></div><button onClick={() => { setForm(EMPTY_CONTACT_LINK); setIsFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#042027] transition hover:bg-cyan-200"><Plus size={17} />وسيلة جديدة</button></div>{isFormOpen && <article className="rounded-3xl border border-cyan-200/20 bg-[#08262b] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{form.id ? "تعديل وسيلة تواصل" : "إضافة وسيلة تواصل"}</h2><button onClick={() => setIsFormOpen(false)} className="text-sm text-slate-400 hover:text-white">إلغاء</button></div><div className="grid gap-4 md:grid-cols-2"><Field label="الاسم — English" value={form.label} onChange={(value) => setForm((current) => ({ ...current, label: value }))} /><Field label="الاسم — العربية (اختياري)" value={form.labelAr} onChange={(value) => setForm((current) => ({ ...current, labelAr: value }))} /><label className="block text-sm font-medium text-slate-300">نوع وسيلة التواصل<select className="mt-2 w-full rounded-xl border border-cyan-100/15 bg-[#071c21] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ContactLinkType }))}>{CONTACT_LINK_TYPES.map((type) => <option key={type} value={type}>{CONTACT_LINK_LABELS[type].ar} / {CONTACT_LINK_LABELS[type].en}</option>)}</select></label><Field label="ترتيب الظهور" value={String(form.sortOrder)} onChange={(value) => setForm((current) => ({ ...current, sortOrder: Number(value) || 0 }))} /><div className="md:col-span-2"><Field label={form.type === "phone" ? "رقم الهاتف (مثال: +201234567890)" : "الرابط الكامل (https://...)"} value={form.url} onChange={(value) => setForm((current) => ({ ...current, url: value }))} /><p className="mt-2 text-xs text-slate-500">رقم الهاتف يتحول تلقائيًا إلى رابط اتصال. أما واتساب وبقية المنصات فتحتاج رابطًا يبدأ بـ https://.</p></div><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))} />إظهارها في صفحة التواصل</label></div><button onClick={save} disabled={create.isPending || update.isPending} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#042027] disabled:opacity-60"><Save size={17} />حفظ وسيلة التواصل</button></article>}<div className="grid gap-4 lg:grid-cols-2">{links?.map((link) => <article key={link.id} className="flex gap-4 rounded-2xl border border-white/10 bg-[#08262b]/85 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200"><Link2 size={19} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.13em] text-cyan-300">{CONTACT_LINK_LABELS[link.type].en}</p><h2 className="mt-1 truncate text-lg font-semibold text-white">{link.labelAr || link.label}</h2></div><span className={`rounded-full px-2 py-1 text-xs ${link.isPublished ? "bg-cyan-300/15 text-cyan-200" : "bg-white/10 text-slate-400"}`}>{link.isPublished ? "منشور" : "مخفي"}</span></div><p className="mt-2 truncate text-sm text-slate-400" dir="ltr">{link.url}</p><div className="mt-3 flex gap-3"><button onClick={() => { setForm({ id: link.id, label: link.label, labelAr: link.labelAr ?? "", type: link.type, url: link.url.replace(/^tel:/, ""), sortOrder: link.sortOrder, isPublished: link.isPublished }); setIsFormOpen(true); }} className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100"><Pencil size={14} />تعديل</button><button onClick={() => { if (window.confirm(`حذف ${link.labelAr || link.label}؟`)) remove.mutate({ id: link.id }); }} className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"><Trash2 size={14} />حذف</button><a href={link.url} target={link.type === "phone" ? undefined : "_blank"} rel={link.type === "phone" ? undefined : "noreferrer"} className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"><ExternalLink size={14} />فتح</a></div></div></article>)}</div>{!links?.length && <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400"><Link2 className="mx-auto mb-3 text-cyan-300" /><p>لا توجد أرقام أو روابط مضافة بعد.</p></div>}</section>;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const isProjects = location === "/admin/projects";
  const isContact = location === "/admin/contact";
  const title = useMemo(() => (isProjects ? "المشاريع" : isContact ? "التواصل" : "المحتوى"), [isContact, isProjects]);

  return <DashboardLayout>{loading ? null : user?.role !== "admin" ? <div className="grid min-h-[70vh] place-items-center rounded-3xl border border-rose-300/20 bg-[#071c21]/90 p-8 text-center"><ShieldAlert className="mb-4 text-rose-300" size={40} /><h1 className="text-2xl font-semibold text-white">هذه الصفحة خاصة بصاحب الموقع</h1><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">سجّل الدخول بحساب مالك المشروع للوصول إلى لوحة التحكم.</p><Link href="/" className="mt-5 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#042027]">العودة للموقع</Link></div> : <div className="min-h-screen bg-[#04171b]/92 p-2 text-right lg:ml-[var(--sidebar-width)]" dir="rtl"><div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-[#061f24]/90 p-5 shadow-2xl md:p-8"><p className="mb-6 text-sm text-slate-500">لوحة الإدارة / {title}</p>{isProjects ? <ProjectsEditor /> : isContact ? <ContactLinksEditor /> : <ContentEditor />}</div></div>}</DashboardLayout>;
}
