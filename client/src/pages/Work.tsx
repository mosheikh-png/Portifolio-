// Style: An editorial grid of category cards which lead to individual project pages.
import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import RichTextContent from "@/components/RichTextContent";
import SiteHeader from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";
import { mergePortfolioContent } from "@/lib/portfolioContent";
import { getWorkCategoryLabel, WORK_CATEGORIES } from "@/lib/workCategories";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Work() {
  const { data: contentData } = trpc.cms.publicContent.useQuery();
  const { language, copy } = useLanguage();
  const content = mergePortfolioContent(contentData, language);
  const [workFirst, workAccent = ""] = content.workTitle.split(/\s+(?=\S+$)/);

  return (
    <main className="portfolio-app inner-app">
      <section className="portfolio-shell inner-shell">
        <SiteHeader />
        <section className="page-intro"><p className="page-label">{content.workLabel}</p><h1>{workFirst}<br />{workAccent && <em>{workAccent}</em>}</h1><RichTextContent html={content.workDescription} className="rich-text-content" /></section>
        <section className="work-grid work-category-grid" aria-label="Portfolio categories">
          {WORK_CATEGORIES.map((category, index) => <Link key={category.slug} href={`/work/${category.slug}`} className="work-card work-category-card" aria-label={`${copy.exploreCategory}: ${getWorkCategoryLabel(category, language)}`}>
            <div className="work-image"><img src={category.imageUrl} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" /><span>{String(index + 1).padStart(2, "0")}</span><div className="work-open"><ArrowUpRight size={18} /></div></div>
            <div className="work-meta"><div><p>{copy.exploreCategory}</p><h2>{getWorkCategoryLabel(category, language)}</h2></div><span className="work-meta-open"><ArrowUpRight size={17} /></span></div>
          </Link>)}
        </section>
        <footer className="inner-footer"><span>{copy.moreProjects}</span><span>{content.homeName} — {copy.graphicDesigner}</span></footer>
      </section>
    </main>
  );
}
