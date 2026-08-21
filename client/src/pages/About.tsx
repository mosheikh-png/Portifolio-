// Style: Editorial CV page — a three-column profile, skills, and experience composition.
import { ArrowDownToLine, ArrowUpRight, Quote } from "lucide-react";
import RichTextContent from "@/components/RichTextContent";
import SiteHeader from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { mergePortfolioContent } from "@/lib/portfolioContent";
import { getCvData } from "@/lib/aboutCvData";
import { useLanguage } from "@/contexts/LanguageContext";

export default function About() {
  const { data } = trpc.cms.publicContent.useQuery();
  const { language, copy } = useLanguage();
  const content = mergePortfolioContent(data, language);
  const cv = getCvData(language);
  const name = content.homeName || "Mohamed Adel";

  return (
    <main className="portfolio-app inner-app">
      <section className="portfolio-shell inner-shell">
        <SiteHeader />
        <section className="about-cv">
          <aside className="about-cv-sidebar">
            <section className="cv-panel">
              <h2 className="cv-section-heading">{copy.software}</h2>
              <div className="cv-software-grid">
                {cv.software.map(([mark, label]) => <div className="cv-tool" key={label}><span>{mark}</span><small>{label}</small></div>)}
              </div>
            </section>
            <section className="cv-panel cv-skills-panel">
              <h2 className="cv-section-heading">{copy.skills}</h2>
              <ul className="cv-skill-list">{cv.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
            </section>
          </aside>
          <section className="about-cv-details">
            <section className="cv-panel">
              <h2 className="cv-section-heading">{copy.languages}</h2>
              <div className="cv-language-list">
                {cv.languages.map((item) => <article className="cv-language-card" key={item.name}><span className="cv-language-flag">{item.flag}</span><strong>{item.name}</strong><div className="cv-language-level"><small>{item.level}</small><span>{Array.from({ length: 4 }, (_, index) => <i className={index < item.dots ? "is-filled" : ""} key={index} />)}</span></div></article>)}
              </div>
            </section>
            <section className="cv-panel cv-experience-panel">
              <h2 className="cv-section-heading">{copy.experience}</h2>
              <div className="cv-timeline">
                {cv.experience.map((item) => <article className="cv-timeline-item" key={`${item.title}-${item.date}`}><span className="cv-timeline-dot" /><div><h3>{item.title}</h3><p>{item.summary}</p></div><time>{item.date}</time></article>)}
              </div>
            </section>
            <a className="cv-request-card" href={`mailto:${content.contactEmail}?subject=CV%20request`}><span className="cv-request-icon"><ArrowDownToLine size={25} /></span><span><strong>{copy.requestCv}</strong><small>{copy.requestCvDetail}</small></span><ArrowUpRight className="cv-request-arrow" size={23} /></a>
          </section>
          <section className="about-cv-profile">
            <header className="cv-profile-header">
              <h1>{name}</h1>
              <p className="cv-profile-kicker">{copy.curriculumVitae}</p>
              <p className="cv-profile-role">{content.homeRole}</p>
            </header>
            <article className="cv-quote-card">
              <Quote className="cv-quote-mark cv-quote-mark-top" size={47} fill="currentColor" />
              <RichTextContent html={content.aboutLead} className="rich-text-content" />
              <div className="cv-quote-points"><span>{content.aboutPointOne}</span><span>{content.aboutPointTwo}</span><span>{content.aboutPointThree}</span></div>
              <Quote className="cv-quote-mark cv-quote-mark-bottom" size={47} fill="currentColor" />
            </article>
            <div className="cv-profile-facts"><span><small>{copy.focus}</small>{content.aboutFocus}</span><span><small>{copy.basedIn}</small>{content.aboutLocation}</span><span><small>{copy.availableFor}</small>{content.aboutAvailability}</span></div>
          </section>
        </section>
        <footer className="inner-footer"><span>{copy.curriculumVitae} — {content.homeRole}</span><span>{name} — {content.footerYear}</span></footer>
      </section>
    </main>
  );
}
