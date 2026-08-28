import Link from "next/link";
import { CinematicGlobe } from "@/components/stage/CinematicGlobe";
import { t } from "@/lib/i18n";

export default function LandingPage() {
  return (
    <main className="landing">
      <CinematicGlobe />
      <div className="landing-veil" />
      <div className="landing-card">
        <p className="landing-kicker">{t("landing.subtitle")}</p>
        <h1>{t("landing.title")}</h1>
        <p className="landing-season">{t("landing.seasonName")}</p>
        <p className="landing-season-id">{t("landing.seasonId")}</p>
        <p className="landing-ethics">{t("landing.ethics")}</p>
        <Link className="landing-play" href="/assign">
          {t("landing.play")}
        </Link>
      </div>
    </main>
  );
}
