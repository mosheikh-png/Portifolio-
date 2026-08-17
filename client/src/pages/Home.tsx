// Style: Reference-faithful hero with dynamic text managed from the private CMS.
import { ArrowRight, BriefcaseBusiness, Mail, UserRound } from "lucide-react";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import RichTextContent from "@/components/RichTextContent";
import { trpc } from "@/lib/trpc";
import { mergePortfolioContent } from "@/lib/portfolioContent";
import { useLanguage } from "@/contexts/LanguageContext";

const HERO_PORTRAIT = "/manus-storage/mohamed-adel-hero-portrait_8ea5ea10.webp";

export default function Home() {
  const { data } = trpc.cms.publicContent.useQuery();
  const { copy, language } = useLanguage();
  const content = mergePortfolioContent(data, language);
  const actions = [
    { title: copy.myWork, href: "/work", icon: BriefcaseBusiness },
    { title: copy.aboutMe, href: "/about", icon: UserRound },
    { title: copy.contactMe, href: "/contact", icon: Mail },
  ];

  return (
    <main className="portfolio-app home-app">
      <section className="portfolio-shell home-shell">
        <SiteHeader />
        <section className="cover-hero">
          <div className="cover-portrait"><img src={HERO_PORTRAIT} alt="Mohamed Adel" loading="eager" fetchPriority="high" decoding="async" /></div>
          <div className="cover-years"><span>{content.homeStartYear}</span><i /><span>{content.homeEndYear}</span></div>
          <div className="cover-copy">
            <p className="cover-kicker">{content.homeKicker}</p>
            <h1>{content.homeTitle}</h1>
            <p className="cover-name">{content.homeName}</p>
            <p className="cover-role">{content.homeRole}</p>
            <span className="cover-rule" />
            <RichTextContent html={content.homeDescription} className="cover-description rich-text-content" />
          </div>
          <div className="cover-actions" aria-label={copy.portfolioNavigation}>
            {actions.map(({ title, href, icon: Icon }) => (
              <Link className="cover-action-card" href={href} key={href}>
                <span className="liquid-orb"><Icon size={28} strokeWidth={1.6} /></span>
                <strong>{title}</strong>
                <ArrowRight size={19} className="cover-card-arrow" />
              </Link>
            ))}
          </div>
        </section>
        <footer className="cover-footer"><span>© {content.footerYear} {content.homeName}</span><span>{copy.graphicDesigner}</span><a href={`mailto:${content.footerEmail}`}>{content.footerEmail}</a></footer>
      </section>
    </main>
  );
}
