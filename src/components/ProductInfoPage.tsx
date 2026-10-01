import { useI18n } from "../i18n";\nimport { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type PageKind="about"|"privacy"|"terms";

type Props={
  page:PageKind;
  onBack:()=>void;
  onOpenPrivacy:()=>void;
  onOpenTerms:()=>void;
  onOpenAbout:()=>void;
};

const RIOT_NOTICE="Chibi.gg isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

function RiotNotice(){
  const { t }=useI18n();
  return <section className="legal-riot-notice" aria-label="Riot Games legal notice">
    <span>{t("legal.riotNotice")}</span>
    <p>{RIOT_NOTICE}</p>
    <p>{t("legal.riotSecond")}</p>
  </section>;
}

function About(){
  const { t }=useI18n();
  return <>
    <section className="legal-hero page-hero-with-reference legal-hero-art">
      <AdaptiveArtwork className="page-reference-art legal-reference-art" src={SITE_IMAGES.ui.all[20]} alt="" aria-hidden="true" loading="eager" decoding="async"/>
      <span>{t("legal.about.kicker")}</span>
      <h1>{t("legal.about.title1")}<br/><em>{t("legal.about.title2")}</em></h1>
      <p>{t("legal.about.intro")}</p>
    </section>

    <section className="legal-grid">
      <article>
        <b>01</b>
        <span>{t("legal.about.search.label")}</span>
        <h2>{t("legal.about.search.title")}</h2>
        <p>{t("legal.about.search.desc")}</p>
      </article>
      <article>
        <b>02</b>
        <span>{t("legal.about.post.label")}</span>
        <h2>{t("legal.about.post.title")}</h2>
        <p>{t("legal.about.post.desc")}</p>
      </article>
      <article>
        <b>03</b>
        <span>{t("legal.about.review.label")}</span>
        <h2>{t("legal.about.review.title")}</h2>
        <p>{t("legal.about.review.desc")}</p>
      </article>
      <article>
        <b>04</b>
        <span>{t("legal.about.dataset.label")}</span>
        <h2>{t("legal.about.dataset.title")}</h2>
        <p>{t("legal.about.dataset.desc")}</p>
      </article>
    </section>

    <section className="legal-section">
      <div className="legal-section-title">
        <span>{t("legal.about.sources.label")}</span>
        <h2>{t("legal.about.sources.title")}</h2>
      </div>
      <div className="legal-source-list">
        <div><strong>account-v1</strong><p>{t("legal.about.account")}</p></div>
        <div><strong>tft-summoner-v1</strong><p>{t("legal.about.summoner")}</p></div>
        <div><strong>tft-league-v1</strong><p>{t("legal.about.league")}</p></div>
        <div><strong>tft-match-v1</strong><p>{t("legal.about.match")}</p></div>
        <div><strong>tft-status-v1</strong><p>{t("legal.about.status")}</p></div>
        <div><strong>Data Dragon / TFT static data</strong><p>{t("legal.about.static")}</p></div>
      </div>
    </section>

    <section className="legal-section">
      <div className="legal-section-title">
        <span>{t("legal.about.accountFlow")}</span>
        <h2>{t("legal.about.accountTitle")}</h2>
      </div>
      <p className="legal-boundary-note">{t("legal.about.accountDesc")}</p>
    </section>

    <section className="legal-section legal-boundaries">
      <div className="legal-section-title">
        <span>{t("legal.about.boundaries")}</span>
        <h2>{t("legal.about.boundariesTitle")}</h2>
      </div>
      <div className="legal-boundary-list">
        <div><i>×</i><p>{t("legal.about.no1")}</p></div>
        <div><i>×</i><p>{t("legal.about.no2")}</p></div>
        <div><i>×</i><p>{t("legal.about.no3")}</p></div>
        <div><i>×</i><p>{t("legal.about.no4")}</p></div>
        <div><i>×</i><p>{t("legal.about.no5")}</p></div>
      </div>
      <p className="legal-boundary-note">{t("legal.about.companion")}</p>
    </section>

    <RiotNotice/>
  </>;
}

function Privacy(){
  const { t }=useI18n();
  return <>
    <section className="legal-hero legal-hero-small">
      <span>{t("legal.privacy.kicker")}</span>
      <h1>{t("legal.privacy.title1")}<br/><em>{t("legal.privacy.title2")}</em></h1>
      <p>{t("legal.privacy.updated")}</p>
    </section>

    <section className="legal-section legal-copy">
      <h2>{t("legal.privacy.1.title")}</h2>
      <p>{t("legal.privacy.1.desc")}</p>

      <h2>{t("legal.privacy.2.title")}</h2>
      <p>{t("legal.privacy.2.a")}</p>
      <p>{t("legal.privacy.2.b")}</p>

      <h2>{t("legal.privacy.3.title")}</h2>
      <p>{t("legal.privacy.3.a")}</p>
      <p>{t("legal.privacy.3.b")}</p>

      <h2>{t("legal.privacy.4.title")}</h2>
      <p>{t("legal.privacy.4.desc")}</p>

      <h2>{t("legal.privacy.5.title")}</h2>
      <p>{t("legal.privacy.5.a")}</p>
      <p>{t("legal.privacy.5.b")}</p>

      <h2>{t("legal.privacy.6.title")}</h2>
      <p>{t("legal.privacy.6.desc")}</p>

      <h2>{t("legal.privacy.7.title")}</h2>
      <p>{t("legal.privacy.7.a")}</p>
      <p><a href="https://github.com/HelioConde/chibi.gg/issues" target="_blank" rel="noreferrer">{t("legal.privacy.7.link")}</a></p>

      <h2>{t("legal.privacy.8.title")}</h2>
      <p>{t("legal.privacy.8.desc")}</p>
    </section>

    <RiotNotice/>
  </>;
}

function Terms(){
  const { t }=useI18n();
  return <>
    <section className="legal-hero legal-hero-small">
      <span>{t("legal.terms.kicker")}</span>
      <h1>{t("legal.terms.title1")}<br/><em>{t("legal.terms.title2")}</em></h1>
      <p>{t("legal.terms.updated")}</p>
    </section>

    <section className="legal-section legal-copy">
      <h2>{t("legal.terms.1.title")}</h2>
      <p>{t("legal.terms.1.desc")}</p>

      <h2>{t("legal.terms.2.title")}</h2>
      <p>{t("legal.terms.2.desc")}</p>

      <h2>{t("legal.terms.3.title")}</h2>
      <p>{t("legal.terms.3.desc")}</p>

      <h2>{t("legal.terms.4.title")}</h2>
      <p>{t("legal.terms.4.desc")}</p>

      <h2>{t("legal.terms.5.title")}</h2>
      <p>{t("legal.terms.5.desc")}</p>

      <h2>{t("legal.terms.6.title")}</h2>
      <p>{t("legal.terms.6.desc")}</p>
    </section>

    <RiotNotice/>
  </>;
}

export default function ProductInfoPage({
  page,
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAbout,
}:Props){
  const { t }=useI18n();

  return <main className="legal-page">
    <div className="legal-page-nav">
      <button onClick={onBack}>{t("common.back")}</button>
      <nav aria-label={t("legal.navAria")}>
        <button className={page==="about"?"active":""} onClick={onOpenAbout}>{t("legal.about")}</button>
        <button className={page==="privacy"?"active":""} onClick={onOpenPrivacy}>{t("legal.privacy")}</button>
        <button className={page==="terms"?"active":""} onClick={onOpenTerms}>{t("legal.terms")}</button>
      </nav>
    </div>

    {page==="about"?<About/>:page==="privacy"?<Privacy/>:<Terms/>}

    <div className="legal-official-links">
      <span>{t("legal.policyReferences")}</span>
      <a href="https://developer.riotgames.com/policies/general" target="_blank" rel="noreferrer">Riot Developer General Policies ↗</a>
      <a href="https://www.riotgames.com/en/legal" target="_blank" rel="noreferrer">Riot Legal Jibber Jabber ↗</a>
    </div>
  </main>;
}
