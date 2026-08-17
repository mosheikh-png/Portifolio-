// Style: Minimal contact destination with high-contrast typography and one clear email action.
import { ArrowUpRight, Globe, Instagram, Linkedin, Link2, Mail, MessageCircle, Palette, Phone } from "lucide-react";
import RichTextContent from "@/components/RichTextContent";
import SiteHeader from "@/components/SiteHeader";
import { getContactLinkLabel, type ContactLinkType } from "@shared/contactLinks";
import { trpc } from "@/lib/trpc";
import { mergePortfolioContent } from "@/lib/portfolioContent";
import { useLanguage } from "@/contexts/LanguageContext";

const contactIconByType: Record<ContactLinkType, typeof Link2> = {
  phone: Phone,
  whatsapp: MessageCircle,
  instagram: Instagram,
  linkedin: Linkedin,
  behance: Palette,
  facebook: Link2,
  x: Link2,
  website: Globe,
  other: Link2,
};

export default function Contact() {
  const { data } = trpc.cms.publicContent.useQuery();
  const { data: contactLinks } = trpc.cms.publicContactLinks.useQuery();
  const { copy, language } = useLanguage();
  const content = mergePortfolioContent(data, language);
  const [contactFirst, contactAccent = ""] = content.contactTitle.split(/\s+(?=\S+$)/);
  return (
    <main className="portfolio-app inner-app">
      <section className="portfolio-shell inner-shell contact-shell">
        <SiteHeader />
        <section className="contact-page"><div className="contact-orbit" aria-hidden="true"><span /><span /><span /></div><div className="contact-copy"><p className="page-label">{content.contactLabel}</p><h1>{contactFirst}<br />{contactAccent && <em>{contactAccent}</em>}</h1><RichTextContent html={content.contactDescription} className="rich-text-content" /><a className="contact-email-large" href={`mailto:${content.contactEmail}`}><Mail size={21} /> {content.contactEmail} <ArrowUpRight size={20} /></a>{contactLinks?.length ? <nav className="contact-links" aria-label={language === "ar" ? "قنوات تواصل إضافية" : "Additional contact channels"}>{contactLinks.map((link) => { const Icon = contactIconByType[link.type]; const label = getContactLinkLabel(link.type, language, language === "ar" ? link.labelAr : link.label); return <a key={link.id} href={link.url} target={link.type === "phone" ? undefined : "_blank"} rel={link.type === "phone" ? undefined : "noreferrer"} className="contact-link-card"><Icon size={17} /><span>{label}</span><ArrowUpRight size={15} /></a>; })}</nav> : null}</div><div className="contact-side-note"><span>{copy.responseTime}</span><strong>{content.contactResponseTime}</strong><span>{copy.basedIn}</span><strong>{content.contactLocation}</strong></div></section>
        <footer className="inner-footer"><span>{copy.availableProjects}</span><span>{content.homeName} — {content.homeTitle}</span></footer>
      </section>
    </main>
  );
}
