import { useMemo, useState } from "react";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";
import ArtworkRibbon from "./ArtworkRibbon";
import { TftMatch } from "../api/tft";
import { getActiveSession, sessionProgress } from "../sessionMode";
import { useI18n } from "../i18n";

type OverlayStateId="stable"|"weak"|"contested"|"spike";

type OverlayScenario={
  id:OverlayStateId;
  label:string;
  tone:"good"|"warning"|"danger"|"neutral";
  stage:string;
  hp:number;
  gold:number;
  level:number;
  streak:string;
  boardStatus:string;
  nowTitle:string;
  now:string[];
  problemTitle:string;
  problems:string[];
  nextSpike:string;
  nextSpikeDetail:string;
  contest:number;
  missing:string[];
  items:string[];
};

function buildScenarios(t:(key:string)=>string):OverlayScenario[]{
  return [
    {
      id:"stable",
      label:t("overlay.scenario.stable.label"),
      tone:"good",
      stage:"3-2",
      hp:82,
      gold:42,
      level:6,
      streak:"W2",
      boardStatus:t("overlay.scenario.stable.status"),
      nowTitle:t("overlay.scenario.stable.title"),
      now:[
        t("overlay.scenario.stable.now1"),
        t("overlay.scenario.stable.now2"),
        t("overlay.scenario.stable.now3"),
      ],
      problemTitle:t("overlay.scenario.stable.problem"),
      problems:[
        t("overlay.scenario.stable.problem1"),
        t("overlay.scenario.stable.problem2"),
        t("overlay.scenario.stable.problem3"),
      ],
      nextSpike:t("overlay.scenario.studyQuestion"),
      nextSpikeDetail:t("overlay.scenario.stable.study"),
      contest:2,
      missing:[t("overlay.scenario.stable.missing1"),t("overlay.scenario.stable.missing2")],
      items:[t("overlay.scenario.stable.item1"),t("overlay.scenario.stable.item2")],
    },
    {
      id:"weak",
      label:t("overlay.scenario.weak.label"),
      tone:"danger",
      stage:"3-2",
      hp:61,
      gold:36,
      level:6,
      streak:"L3",
      boardStatus:t("overlay.scenario.weak.status"),
      nowTitle:t("overlay.scenario.weak.title"),
      now:[
        t("overlay.scenario.weak.now1"),
        t("overlay.scenario.weak.now2"),
        t("overlay.scenario.weak.now3"),
      ],
      problemTitle:t("overlay.scenario.weak.problem"),
      problems:[
        t("overlay.scenario.weak.problem1"),
        t("overlay.scenario.weak.problem2"),
        t("overlay.scenario.weak.problem3"),
      ],
      nextSpike:t("overlay.scenario.studyQuestion"),
      nextSpikeDetail:t("overlay.scenario.weak.study"),
      contest:2,
      missing:[t("overlay.scenario.weak.missing1"),t("overlay.scenario.weak.missing2")],
      items:[t("overlay.scenario.weak.item1"),t("overlay.scenario.weak.item2")],
    },
    {
      id:"contested",
      label:t("overlay.scenario.transition.label"),
      tone:"warning",
      stage:"4-1",
      hp:54,
      gold:31,
      level:7,
      streak:"L1",
      boardStatus:t("overlay.scenario.transition.status"),
      nowTitle:t("overlay.scenario.transition.title"),
      now:[
        t("overlay.scenario.transition.now1"),
        t("overlay.scenario.transition.now2"),
        t("overlay.scenario.transition.now3"),
      ],
      problemTitle:t("overlay.scenario.transition.problem"),
      problems:[
        t("overlay.scenario.transition.problem1"),
        t("overlay.scenario.transition.problem2"),
        t("overlay.scenario.transition.problem3"),
      ],
      nextSpike:t("overlay.scenario.studyQuestion"),
      nextSpikeDetail:t("overlay.scenario.transition.study"),
      contest:1,
      missing:[t("overlay.scenario.transition.missing1"),t("overlay.scenario.transition.missing2")],
      items:[t("overlay.scenario.transition.item1"),t("overlay.scenario.transition.item2")],
    },
    {
      id:"spike",
      label:t("overlay.scenario.spike.label"),
      tone:"good",
      stage:"4-2",
      hp:67,
      gold:18,
      level:8,
      streak:"W3",
      boardStatus:t("overlay.scenario.spike.status"),
      nowTitle:t("overlay.scenario.spike.title"),
      now:[
        t("overlay.scenario.spike.now1"),
        t("overlay.scenario.spike.now2"),
        t("overlay.scenario.spike.now3"),
      ],
      problemTitle:t("overlay.scenario.spike.problem"),
      problems:[
        t("overlay.scenario.spike.problem1"),
        t("overlay.scenario.spike.problem2"),
        t("overlay.scenario.spike.problem3"),
      ],
      nextSpike:t("overlay.scenario.studyQuestion"),
      nextSpikeDetail:t("overlay.scenario.spike.study"),
      contest:2,
      missing:[t("overlay.scenario.spike.missing1"),t("overlay.scenario.spike.missing2")],
      items:[t("overlay.scenario.spike.item1"),t("overlay.scenario.spike.item2")],
    },
  ];
}

const DEMO_UNITS=["V","A","M","S","K","T","N","R"];

export default function OverlayPage({
  hasProfile=false,
  playerName="",
  playerKey="",
  matches=[],
  onBack,
}:{
  hasProfile?:boolean;
  playerName?:string;
  playerKey?:string;
  matches?:TftMatch[];
  onBack:()=>void;
}){
  const { t } = useI18n();
  const scenarios=useMemo(()=>buildScenarios(t),[t]);
  const [scenarioId,setScenarioId]=useState<OverlayStateId>("weak");
  const [compact,setCompact]=useState(false);

  const scenario=useMemo(
    ()=>scenarios.find(item=>item.id===scenarioId)||scenarios[0],
    [scenarioId,scenarios],
  );

  const activeSession=useMemo(
    ()=>playerKey?getActiveSession(playerKey):null,
    [playerKey],
  );
  const activeSessionProgress=useMemo(
    ()=>activeSession?sessionProgress(activeSession,matches):null,
    [activeSession,matches],
  );

  return <main className="overlay-page">
    <section className="overlay-page-hero overlay-page-hero-art">
      <AdaptiveArtwork className="v2-hero-emblem v2-hero-emblem-companion" src={SITE_IMAGES.v2.mascots.scout} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
      <AdaptiveArtwork className="overlay-page-art" src={SITE_IMAGES.ui.all[15]} alt="" aria-hidden="true" loading="eager" decoding="async"/>
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>{t("common.backProfile")}</button>}
        <span className="eyebrow">CHIBI COMPANION · REVIEW FIRST</span>
        <h1>{t("overlay.hero.title1")}<br/><em>{t("overlay.hero.title2")}</em></h1>
        <p>{t("overlay.hero.desc")}</p>
      </div>

      <div className="overlay-beta-card">
        <span>{t("overlay.currentPhase")}</span>
        <strong>Python Desktop v1</strong>
        <small>{t("overlay.localWindow")}</small>
        <b>{t("overlay.localPrototype")}</b>
      </div>
    </section>

    <ArtworkRibbon sources={[SITE_IMAGES.v2.mascots.scout,SITE_IMAGES.v2.icons[8],SITE_IMAGES.v2.frames.landscape]} className="overlay-art-ribbon"/>

    {activeSession&&<section className="panel overlay-session-focus">
      <div className="overlay-session-focus-head">
        <div>
          <span>{t("overlay.fixedFocus")}</span>
          <h2>{activeSession.focusTitle}</h2>
          <p>{t("overlay.focusDesc")}</p>
        </div>
        <div className="overlay-session-progress">
          <small>CHIBI SESSION</small>
          <strong>{activeSessionProgress?.played||0}/{activeSession.targetGames}</strong>
          <span>{t("overlay.games")}</span>
        </div>
      </div>

      <div className="overlay-session-rule">
        <div>
          <span>{t("overlay.reminder")}</span>
          <ol>
            {activeSession.focusSteps.slice(0,2).map((step,index)=>(
              <li key={index}><b>{index+1}</b><p>{step}</p></li>
            ))}
          </ol>
        </div>
        <aside>
          <span>{t("overlay.avoid")}</span>
          <p>{activeSession.avoid}</p>
        </aside>
      </div>

      <small className="overlay-session-safety">{t("overlay.sessionSafety")}</small>
    </section>}

    <section className="overlay-demo-shell">
      <div className="overlay-demo-toolbar">
        <div>
          <span>{t("overlay.scenariosDemo")}</span>
          {scenarios.map(item=>(
            <button
              key={item.id}
              className={scenarioId===item.id?"active":""}
              onClick={()=>setScenarioId(item.id)}
            >{item.label}</button>
          ))}
        </div>
        <button className={compact?"active":""} onClick={()=>setCompact(value=>!value)}>
          {compact?t("overlay.expanded"):t("overlay.compact")}
        </button>
      </div>

      <div className={"overlay-live-demo "+(compact?"compact":"")+" tone-"+scenario.tone}>
        <img className="overlay-hud-art" src={SITE_IMAGES.hud} alt="" aria-hidden="true"/>
        <header className="overlay-live-head">
          <div className="overlay-live-brand">
            <span className="overlay-brand-image"><img src={SITE_IMAGES.icon} alt=""/></span>
            <div>
              <strong>Chibi Review HUD</strong>
              <small>{hasProfile&&playerName?playerName:t("overlay.localDemo")} · {t("overlay.postReview")}</small>
            </div>
          </div>
          <div className="overlay-live-status">
            <i/>
            <span>REVIEW DEMO</span>
          </div>
        </header>

        <div className="overlay-live-body">
          <aside className="overlay-state-rail">
            <div><span>STAGE</span><strong>{scenario.stage}</strong></div>
            <div><span>HP</span><strong>{scenario.hp}</strong></div>
            <div><span>GOLD</span><strong>{scenario.gold}</strong></div>
            <div><span>LVL</span><strong>{scenario.level}</strong></div>
            <div><span>STREAK</span><strong>{scenario.streak}</strong></div>
          </aside>

          <section className="overlay-primary">
            <div className="overlay-board-status">
              <div>
                <span>{t("overlay.snapshotRead")}</span>
                <strong>{scenario.boardStatus}</strong>
              </div>
              <b>DEMO</b>
            </div>

            <article className="overlay-now-card">
              <span>{t("overlay.whatReview")}</span>
              <h2>{scenario.nowTitle}</h2>
              <ol>
                {scenario.now.map((item,index)=>(
                  <li key={item}><b>{index+1}</b><p>{item}</p></li>
                ))}
              </ol>
            </article>

            {!compact&&<div className="overlay-board-preview">
              <div className="overlay-board-copy">
                <span>{t("overlay.snapshotBoard")}</span>
                <small>{t("overlay.allowedStructure")}</small>
              </div>
              <div className="overlay-hex-board" aria-label={t("overlay.boardDemoAria")}>
                {Array.from({length:28}).map((_,index)=>{
                  const unitIndex=[15,16,18,21,23,24,25,27].indexOf(index);
                  return <div className={"overlay-hex "+(unitIndex>=0?"occupied":"")} key={index}>
                    {unitIndex>=0&&<span>{DEMO_UNITS[unitIndex]}</span>}
                  </div>;
                })}
              </div>
              <div className="overlay-board-foot">
                <span>{t("overlay.missing")}: <b>{scenario.missing.join(" · ")}</b></span>
                <span>{t("overlay.items")}: <b>{scenario.items.join(" · ")}</b></span>
              </div>
            </div>}
          </section>

          <aside className="overlay-signals">
            <article className="overlay-problem">
              <span>{t("overlay.patternInvestigate")}</span>
              <h3>{scenario.problemTitle}</h3>
              <ul>{scenario.problems.map(item=><li key={item}>{item}</li>)}</ul>
            </article>

            <article className="overlay-spike">
              <span>{t("overlay.whatStudy")}</span>
              <h3>{scenario.nextSpike}</h3>
              <p>{scenario.nextSpikeDetail}</p>
            </article>

            <article className="overlay-contest">
              <span>{t("overlay.signalConfidence")}</span>
              <strong>{scenario.contest>=2?t("overlay.confidence.high"):scenario.contest===1?t("overlay.confidence.medium"):t("overlay.confidence.low")}</strong>
              <small>{t("overlay.fakeScore")}</small>
            </article>
          </aside>
        </div>
      </div>

      <p className="overlay-demo-note">{t("overlay.demoNote")}</p>
    </section>

    <section className="panel overlay-companion-status">
      <div className="overlay-companion-title">
        <div>
          <span>CHIBI COMPANION · GM1.2</span>
          <h2>{t("overlay.foundation.title")}</h2>
          <p>{t("overlay.foundation.desc")}</p>
        </div>
        <b>DESKTOP FOUNDATION</b>
      </div>

      <div className="overlay-companion-grid">
        <article>
          <span>HOTKEY</span>
          <strong>Ctrl + Shift + Space</strong>
          <small>{t("overlay.hotkey.desc")}</small>
        </article>
        <article>
          <span>CLICK-THROUGH</span>
          <strong>Ctrl + Shift + L</strong>
          <small>{t("overlay.click.desc")}</small>
        </article>
        <article>
          <span>PRESETS</span>
          <strong>{t("overlay.presets.value")}</strong>
          <small>{t("overlay.presets.desc")}</small>
        </article>
        <article>
          <span>MONITOR</span>
          <strong>{t("overlay.monitor.value")}</strong>
          <small>{t("overlay.monitor.desc")}</small>
        </article>
      </div>
    </section>

    <section className="overlay-principles">
      <article>
        <span>01</span>
        <h3>{t("overlay.principle.1.title")}</h3>
        <p>{t("overlay.principle.1.desc")}</p>
      </article>
      <article>
        <span>02</span>
        <h3>{t("overlay.principle.2.title")}</h3>
        <p>{t("overlay.principle.2.desc")}</p>
      </article>
      <article>
        <span>03</span>
        <h3>{t("overlay.principle.3.title")}</h3>
        <p>{t("overlay.principle.3.desc")}</p>
      </article>
      <article>
        <span>04</span>
        <h3>{t("overlay.principle.4.title")}</h3>
        <p>{t("overlay.principle.4.desc")}</p>
      </article>
    </section>

    <section className="panel overlay-roadmap">
      <div className="overlay-roadmap-head">
        <div>
          <span>CHIBI COMPANION</span>
          <h2>{t("overlay.roadmap.title")}</h2>
        </div>
        <small>{t("overlay.roadmap.change")}</small>
      </div>

      <div className="overlay-roadmap-grid">
        <article className="done">
          <b>1</b>
          <div><strong>{t("overlay.roadmap.1.title")}</strong><span>{t("overlay.roadmap.1.desc")}</span></div>
          <em>{t("overlay.roadmap.now")}</em>
        </article>
        <article className="active">
          <b>2</b>
          <div><strong>{t("overlay.roadmap.2.title")}</strong><span>{t("overlay.roadmap.2.desc")}</span></div>
          <em>PYTHON V1</em>
        </article>
        <article>
          <b>3</b>
          <div><strong>{t("overlay.roadmap.3.title")}</strong><span>{t("overlay.roadmap.3.desc")}</span></div>
          <em>{t("overlay.roadmap.approval")}</em>
        </article>
        <article>
          <b>4</b>
          <div><strong>{t("overlay.roadmap.4.title")}</strong><span>{t("overlay.roadmap.4.desc")}</span></div>
          <em>{t("overlay.roadmap.planned")}</em>
        </article>
      </div>
    </section>
  </main>;
}
