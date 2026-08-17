// Style: Shared compact glass navigation for the portfolio's midnight-teal editorial system.
import { Menu, Moon, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

export default function SiteHeader() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage, copy } = useLanguage();
  const { animationsEnabled, preference, setPreference } = useMotionPreference();
  const navItems = [
    { label: copy.home, href: "/" }, { label: copy.work, href: "/work" },
    { label: copy.about, href: "/about" }, { label: copy.contact, href: "/contact" },
  ];

  return (
    <header className="site-header-v2">
      <Link className="site-brand-v2" href="/" onClick={() => setMenuOpen(false)}>
        <span className="brand-monogram-v2">MA</span>
        <span>{language === "ar" ? "محمد عادل" : "MOHAMED ADEL"}</span>
      </Link>
      <nav className={`site-nav-v2 ${menuOpen ? "is-open" : ""}`} aria-label={copy.portfolioNavigation}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={location === item.href ? "is-active" : ""} onClick={() => setMenuOpen(false)}>{item.label}</Link>
        ))}
      </nav>
      <div className="site-header-actions-v2">
        <div className="language-switcher" aria-label="Language selector"><button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>EN</button><button type="button" className={language === "ar" ? "is-active" : ""} onClick={() => setLanguage("ar")}>ع</button></div>
        <Link className="contact-chip-v2" href="/contact">{copy.letsTalk} <span>↗</span></Link>
        <label className={`moon-chip-v2 motion-preference-v2 ${animationsEnabled ? "" : "is-motion-off"}`} title={language === "ar" ? "تفضيل الحركة" : "Motion preference"}>
          <Moon size={17} aria-hidden="true" />
          <select aria-label={language === "ar" ? "تفضيل الحركة" : "Motion preference"} value={preference} onChange={(event) => setPreference(event.target.value as typeof preference)}>
            <option value="system">{language === "ar" ? "النظام" : "System"}</option>
            <option value="enabled">{language === "ar" ? "مفعّلة" : "Enabled"}</option>
            <option value="reduced">{language === "ar" ? "مخفّضة" : "Reduced"}</option>
          </select>
        </label>
        <button className="nav-toggle-v2" onClick={() => setMenuOpen(!menuOpen)} aria-label={copy.portfolioNavigation} aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </header>
  );
}
