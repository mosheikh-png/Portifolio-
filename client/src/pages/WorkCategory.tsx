import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { getWorkCategoryBySlug, getWorkCategoryLabel, WORK_CATEGORIES } from "@/lib/workCategories";
import { useLanguage } from "@/contexts/LanguageContext";

export default function WorkCategory() {
  const [, params] = useRoute("/work/:categorySlug");
  const category = getWorkCategoryBySlug(params?.categorySlug);
  const { language, copy } = useLanguage();
  const { data: managedProjects } = trpc.cms.publicProjects.useQuery();
  const projects = managedProjects ?? [];
  const categoryProjects = useMemo(() => category ? projects.filter((project) => project.category === category.title) : [], [category, projects]);

  if (!category) {
    return <main className="portfolio-app inner-app"><section className="portfolio-shell inner-shell"><SiteHeader /><section className="work-filter-empty"><span>404</span><h2>{copy.categoryMissing}</h2><p>{copy.categoryMissingDetail}</p><Link href="/work" className="category-back-link"><ArrowLeft size={16} />{copy.work}</Link></section></section></main>;
  }

  const categoryLabel = getWorkCategoryLabel(category, language);
  const [firstWord, ...remainingWords] = categoryLabel.split(" ");
  const accentWords = remainingWords.join(" ");

  return (
    <main className="portfolio-app inner-app">
      <section className="portfolio-shell inner-shell">
        <SiteHeader />
        <section className="page-intro category-page-intro"><p className="page-label">02 / {categoryLabel}</p><h1>{firstWord}<br />{accentWords && <em>{accentWords}</em>}</h1><p>{language === "ar" ? `مجموعة مختارة من مشاريع ${categoryLabel} لمحمد عادل.` : `A focused selection of ${category.title.toLowerCase()} projects by Mohamed Adel.`}</p><Link href="/work" className="category-back-link"><ArrowLeft size={16} />{copy.allCategories}</Link></section>
        {categoryProjects.length ? <section className="work-grid">
          {categoryProjects.map((project, index) => (
            <article className="work-card" key={project.id}>
              <div className="work-image"><img src={project.imageUrl} alt={language === "ar" ? (project.titleAr || project.title) : project.title} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" /><span>{String(index + 1).padStart(2, "0")}</span><div className="work-open"><ArrowUpRight size={18} /></div></div>
              <div className="work-meta"><div><p>{getWorkCategoryLabel(WORK_CATEGORIES.find((item) => item.title === project.category) ?? category, language)}</p><h2>{language === "ar" ? (project.titleAr || project.title) : project.title}</h2><p className="sr-only">{language === "ar" ? (project.summaryAr || project.summary) : project.summary}</p></div>{project.projectUrl ? <a href={project.projectUrl} target="_blank" rel="noreferrer" aria-label={language === "ar" ? (project.titleAr || project.title) : project.title} className="work-meta-open"><ArrowUpRight size={17} /></a> : <span className="work-meta-open"><ArrowUpRight size={17} /></span>}</div>
            </article>
          ))}
        </section> : <section className="work-filter-empty"><span>{categoryLabel}</span><h2>{copy.noProjects}</h2><p>{copy.noProjectsDetail}</p></section>}
        <footer className="inner-footer"><span>{copy.moreProjects}</span><span>{language === "ar" ? "محمد عادل" : "Mohamed Adel"} — {copy.graphicDesigner}</span></footer>
      </section>
    </main>
  );
}
