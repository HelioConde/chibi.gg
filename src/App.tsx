import { FormEvent, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTftHistory,
  fetchTftMatch,
  fetchTftProfile,
  TftMatch,
  TftMatchDetail,
  TftProfile,
  TftCompanion,
  TftTrait,
  TftUnit,
} from "./api/tft";
import {
  loadTftStaticData,
  staticEntry,
  tftAssetUrl,
  TftStaticData,
  queueLabel,
  profileIconUrl,
  latestTftSetNumber,
} from "./tftStatic";
import { buildChibiDNA } from "./analysis/chibiInsights";










import ChibiStudyShare, { studyFocusById } from "./components/ChibiStudyShare";





















import type { StatisticsCategory } from "./components/StatisticsPage";
import GlobalSearch from "./components/GlobalSearch";
import HomeMetaPreview from "./components/HomeMetaPreview";
import HomeSessionResume from "./components/HomeSessionResume";
import HomeStudyShelf from "./components/HomeStudyShelf";
import HomeVisualShowcase from "./components/HomeVisualShowcase";
import SiteArtworkBackdrop from "./components/SiteArtworkBackdrop";
import PointerAura from "./components/PointerAura";
import AdaptiveArtwork from "./components/AdaptiveArtwork";
import SectionMarker from "./components/SectionMarker";
import ChibiNavIcon from "./components/ChibiNavIcon";


import ProductInfoPage from "./components/ProductInfoPage";






import RiotServiceStatus from "./components/RiotServiceStatus";
import RiotDataBar from "./components/RiotDataBar";

import AccountMenu from "./components/AccountMenu";
import { SITE_IMAGES } from "./siteAssets";
import { LanguageSwitcher, useI18n } from "./i18n";
import { DEMO_PROFILE, demoMatchDetail, isDemoMatchId } from "./demoProfile";
import { markMatchReviewed } from "./reviewProgress";
import { recordRankSnapshot } from "./rankHistory";
import {
  getRecentPlayers,
  removeRecentPlayer,
  saveRecentPlayer,
  RecentPlayer,
} from "./recentPlayers";

function isCompactClient(){
  if(typeof window==="undefined")return false;
  const viewport=window.matchMedia("(max-width: 820px)").matches;
  const coarse=window.matchMedia("(pointer: coarse)").matches;
  const touch=(navigator.maxTouchPoints||0)>0;
  const mobileUa=/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent);
  const physicalShortSide=Math.min(window.screen?.width||9999,window.screen?.height||9999);
  const phoneLikeScreen=physicalShortSide<=900;
  return viewport||mobileUa||(phoneLikeScreen&&(coarse||touch));
}

function cleanName(value:string){
  return value
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2");
}

function fallbackTraitName(value:string){
  return cleanName(value)
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

type Translate=(key:string,vars?:Record<string,string|number>)=>string;

function activeTraits(match:TftMatch){
  return match.traits
    .filter((t)=>t.numUnits>0 && (t.style>0 || t.numUnits>=2))
    .sort((a,b)=>b.style-a.style || b.numUnits-a.numUnits);
}

function formatClock(timestamp:number|undefined,locale:string){
  if(!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"});
}

function formatDay(timestamp:number|undefined,locale:string){
  if(!timestamp) return "";
  return new Date(timestamp).toLocaleDateString(locale,{day:"2-digit",month:"2-digit"});
}

function formatWhen(timestamp:number|undefined,locale:string,t:Translate){
  if(!timestamp) return "";
  const date=new Date(timestamp);
  const diff=Date.now()-date.getTime();
  const hours=Math.floor(diff/3600000);
  if(hours<1) return t("time.now");
  if(hours<24) return hours+"h";
  const days=Math.floor(hours/24);
  if(days<7) return days+"d";
  return date.toLocaleDateString(locale,{day:"2-digit",month:"2-digit"});
}

function displaySetName(value:string|undefined,setNumber?:number){
  const raw=String(value||"").trim();
  const match=raw.match(/^TFTSet(\d+)$/i);
  if(match) return "Set "+match[1];
  if(raw) return raw;
  return setNumber ? "Set "+setNumber : "Teamfight Tactics";
}

function placementClass(value:number){
  if(value===1) return "p1";
  if(value<=4) return "p2";
  if(value>=7) return "p7";
  return "";
}

function placementBand(value:number){
  if(value===1)return "win";
  if(value<=4)return "top4";
  if(value>=7)return "bottom";
  return "mid";
}

function matchReviewCue(match:TftMatch,t:Translate){
  const threeStars=match.units.filter(unit=>unit.tier>=3).length;

  if(match.placement===1){
    return {
      tone:"good",
      label:t("reviewCue.reference"),
      title:threeStars>0
        ? t("reviewCue.referenceStars",{count:threeStars})
        : t("reviewCue.referenceWin"),
    };
  }

  if(match.placement<=4){
    return {
      tone:"good",
      label:t("reviewCue.top4"),
      title:match.goldLeft>=10
        ? t("reviewCue.top4Gold",{gold:match.goldLeft})
        : t("reviewCue.top4Compare"),
    };
  }

  if(match.placement>=7){
    if(match.goldLeft>=10){
      return {
        tone:"bad",
        label:t("reviewCue.gold"),
        title:t("reviewCue.goldTitle",{gold:match.goldLeft}),
      };
    }
    if(match.level>=8){
      return {
        tone:"bad",
        label:t("reviewCue.level"),
        title:t("reviewCue.levelTitle",{level:match.level}),
      };
    }
    return {
      tone:"bad",
      label:t("reviewCue.first"),
      title:t("reviewCue.firstTitle"),
    };
  }

  if(match.level>=8){
    return {
      tone:"neutral",
      label:t("reviewCue.highLevel"),
      title:t("reviewCue.highLevelTitle",{level:match.level}),
    };
  }

  return {
    tone:"neutral",
    label:t("reviewCue.mid"),
    title:t("reviewCue.midTitle"),
  };
}

function formatDuration(seconds?:number){
  if(!seconds||seconds<=0) return "—";
  const minutes=Math.round(seconds/60);
  return minutes+" min";
}

function splitRiotId(value:string){
  const cut=value.lastIndexOf("#");
  if(cut<1 || cut===value.length-1) return null;
  return {
    gameName:value.slice(0,cut).trim(),
    tagLine:value.slice(cut+1).trim(),
  };
}

function traitLabel(trait:TftTrait, staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,trait.name)?.name || fallbackTraitName(trait.name);
}

function normalizeTraitMatchValue(value:string){
  return fallbackTraitName(String(value||""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();
}

function unitDisplayName(unit:TftUnit,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,unit.characterId)?.name||cleanName(unit.characterId);
}

function unitTraitValues(unit:TftUnit,staticData:TftStaticData|null){
  const entry=staticEntry(staticData?.champions,unit.characterId);
  const values=Array.isArray(entry?.traits)?entry.traits:[];

  return values.flatMap((value)=>{
    const resolved=staticEntry(staticData?.traits,String(value))?.name||"";
    return [
      normalizeTraitMatchValue(String(value)),
      normalizeTraitMatchValue(resolved),
    ].filter(Boolean);
  });
}

function unitHasTrait(unit:TftUnit,trait:TftTrait,staticData:TftStaticData|null){
  const unitValues=new Set(unitTraitValues(unit,staticData));
  const targets=[
    normalizeTraitMatchValue(trait.name),
    normalizeTraitMatchValue(traitLabel(trait,staticData)),
  ].filter(Boolean);

  return targets.some((value)=>unitValues.has(value));
}

function unitTraitPriority(unit:TftUnit,traits:TftTrait[],staticData:TftStaticData|null){
  const index=traits.findIndex((trait)=>unitHasTrait(unit,trait,staticData));
  return index<0 ? Number.MAX_SAFE_INTEGER : index;
}

function UnitVisual({
  unit,
  staticData,
  compact=false,
  showName=false,
}:{unit:TftUnit;staticData:TftStaticData|null;compact?:boolean;showName?:boolean}){
  const entry=staticEntry(staticData?.champions,unit.characterId);
  const name=entry?.name || cleanName(unit.characterId);
  const image=staticData? tftAssetUrl(staticData.version,"champion",entry) : "";

  return <div className={"unit-card "+(compact?"compact ":"")+(showName?"named":"")} title={name}>
    <div className={"unit-portrait cost-"+Math.max(1,Math.min(5,Number(entry?.tier||unit.rarity||1)))}>
      <span className="unit-fallback">{name.slice(0,2)}</span>
      {image&&<img src={image} alt={name} onError={(e)=>{e.currentTarget.style.display="none";}}/>}
      <div className="unit-stars">{"★".repeat(Math.max(1,Math.min(3,unit.tier||1)))}</div>
    </div>
    {(!compact||showName)&&<div className="unit-caption">{name}</div>}
    <div className="item-row">
      {unit.itemNames.slice(0,3).map((itemId,index)=>{
        const item=staticEntry(staticData?.items,itemId);
        const itemImage=staticData?tftAssetUrl(staticData.version,"item",item):"";
        const itemName=item?.name||cleanName(itemId);
        return <span className="item-icon" title={itemName} key={itemId+index}>
          <span>{itemName.slice(0,1)}</span>
          {itemImage&&<img src={itemImage} alt={itemName} onError={(e)=>{e.currentTarget.style.display="none";}}/>}
        </span>;
      })}
    </div>
  </div>;
}


function TraitUnitMini({
  unit,
  staticData,
}:{unit:TftUnit;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.champions,unit.characterId);
  const name=entry?.name||cleanName(unit.characterId);
  const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";

  return <span className="trait-unit-mini" title={name}>
    <span className={"trait-unit-mini-portrait cost-"+Math.max(1,Math.min(5,Number(entry?.tier||unit.rarity||1)))}>
      <span>{name.slice(0,2)}</span>
      {image&&<img src={image} alt={name} onError={(e)=>{e.currentTarget.style.display="none";}}/>}
      <em>{"★".repeat(Math.max(1,Math.min(3,unit.tier||1)))}</em>
    </span>
    <strong>{name}</strong>
  </span>;
}


function MatchResultAccent({placement,className=""}:{placement:number;className?:string}){
  const band=placementBand(placement);
  const src=placement===1
    ? SITE_IMAGES.v2.badges.rankAlt
    :placement<=4
      ?SITE_IMAGES.v2.badges.heartAlt
      :placement>=7
        ?SITE_IMAGES.v2.badges.swordAlt
        :SITE_IMAGES.v2.decor.cornerAlt;

  return <AdaptiveArtwork
    className={"match-result-art match-result-art-"+band+" "+className}
    src={src}
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
  />;
}

function TacticianVisual({
  companion,
  staticData,
}:{companion?:TftCompanion|null;staticData:TftStaticData|null}){
  if(!companion)return null;

  const candidates=[
    companion.contentId,
    companion.itemId,
    companion.skinId,
    companion.species,
  ].filter(Boolean);

  let entry=undefined;
  for(const candidate of candidates){
    entry=staticEntry(staticData?.tacticians,candidate);
    if(entry)break;
  }

  if(!entry&&staticData?.tacticians){
    const normalized=candidates.map(value=>value.toLowerCase());
    entry=Object.values(staticData.tacticians).find((row)=>{
      const source=[
        String(row.id||""),
        String(row.name||""),
        String(row.image?.full||""),
      ].join(" ").toLowerCase();
      return normalized.some(value=>value&&source.includes(value));
    });
  }

  const name=entry?.name||cleanName(companion.species||companion.contentId||"Chibi");
  const image=staticData?tftAssetUrl(staticData.version,"tactician",entry):"";

  return <span className="match-tactician" title={name}>
    <span>{name.slice(0,2)}</span>
    {image&&<img src={image} alt={name} onError={(e)=>{e.currentTarget.style.display="none";}}/>}
  </span>;
}

function AugmentIcon({id,staticData}:{id:string;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.augments,id);
  const image=staticData?tftAssetUrl(staticData.version,"augment",entry):"";
  const name=entry?.name||cleanName(id);

  return <span className="match-augment-icon" title={name}>
    <span>{name.slice(0,1)}</span>
    {image&&<img src={image} alt={name} onError={(e)=>{e.currentTarget.style.display="none";}}/>}
  </span>;
}

function AugmentVisual({id,staticData}:{id:string;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.augments,id);
  const image=staticData?tftAssetUrl(staticData.version,"augment",entry):"";
  const name=entry?.name||cleanName(id);
  return <span className="augment-chip" title={name}>
    {image&&<img src={image} alt=""/>}
    <span>{name}</span>
  </span>;
}

type StudyRequest={
  matchId:string;
  focusId:string;
  sessionFocus:string;
  source:string;
  note:string;
  reply:string;
  reviewer:string;
};

function readStudyRequest():StudyRequest|null{
  const params=new URLSearchParams(window.location.search);
  const matchId=params.get("study")?.trim()||"";
  if(!matchId)return null;
  return {
    matchId,
    focusId:params.get("focus")?.trim()||"lost",
    sessionFocus:params.get("sessionFocus")?.trim().slice(0,32)||"",
    source:params.get("source")?.trim().slice(0,32)||"",
    note:params.get("note")?.trim().slice(0,220)||"",
    reply:params.get("reply")?.trim().slice(0,320)||"",
    reviewer:params.get("reviewer")?.trim().slice(0,32)||"",
  };
}

function sessionFocusLabel(value:string,t:Translate){
  return ({
    economy:t("sessionFocus.economy"),
    positioning:t("sessionFocus.positioning"),
    flexibility:t("sessionFocus.flexibility"),
    items:t("sessionFocus.items"),
    tempo:t("sessionFocus.tempo"),
    custom:t("sessionFocus.custom"),
  } as Record<string,string>)[value]||value;
}

type ProfileTab = "overview"|"coach"|"matches"|"share";
type HistoryDensity="compact"|"detailed";
type HistorySort="date"|"placement"|"stage";

function parseProfileTab(value:string|null):ProfileTab{
  if(value==="review"||value==="meta"||value==="coach") return "coach";
  return value==="overview"||value==="share"
    ? value
    : "matches";
}

function unitShopCost(unit:TftUnit,staticData:TftStaticData|null){
  const entry=staticEntry(staticData?.champions,unit.characterId);
  const cost=Math.max(1,Math.min(5,Number(entry?.tier||unit.rarity+1||1)));
  const copies=unit.tier>=3?9:unit.tier===2?3:1;
  return cost*copies;
}

function boardValue(match:TftMatch,staticData:TftStaticData|null){
  return match.units.reduce((sum,unit)=>sum+unitShopCost(unit,staticData),0);
}

function matchRoundLabel(match:TftMatch){
  const round=Number(match.lastRound)||0;
  if(round<5) return round>0?"Round "+round:"";
  const offset=round-5;
  const stage=2+Math.floor(offset/7);
  const step=1+(offset%7);
  return "Stage "+stage+"-"+step;
}

const ChibiLearningLab = lazy(() => import("./components/ChibiLearningLab"));
const ChibiReview = lazy(() => import("./components/ChibiReview"));
const PlayerEvolution = lazy(() => import("./components/PlayerEvolution"));
const PersonalVsGlobalMeta = lazy(() => import("./components/PersonalVsGlobalMeta"));
const ChibiSessionPlan = lazy(() => import("./components/ChibiSessionPlan"));
const ChibiLearningPath = lazy(() => import("./components/ChibiLearningPath"));
const MatchJournal = lazy(() => import("./components/MatchJournal"));
const ChibiSessionMode = lazy(() => import("./components/ChibiSessionMode"));
const PatchAdaptation = lazy(() => import("./components/PatchAdaptation"));
const MatchStory = lazy(() => import("./components/MatchStory"));
const ChibiBoardDrill = lazy(() => import("./components/ChibiBoardDrill"));
const ChibiJournalPatterns = lazy(() => import("./components/ChibiJournalPatterns"));
const MatchReviewOverview = lazy(() => import("./components/MatchReviewOverview"));
const LobbyAutopsy = lazy(() => import("./components/LobbyAutopsy"));
const ChibiPool = lazy(() => import("./components/ChibiPool"));
const ChibiInnovations = lazy(() => import("./components/ChibiInnovations"));
const ActiveGoalStrip = lazy(() => import("./components/ActiveGoalStrip"));
const ChibiLessons = lazy(() => import("./components/ChibiLessons"));
const ChibiCoachMode = lazy(() => import("./components/ChibiCoachMode"));
const ChibiStudyReply = lazy(() => import("./components/ChibiStudyReply"));
const BoardCounterfactual = lazy(() => import("./components/BoardCounterfactual"));
const MatchScorecard = lazy(() => import("./components/MatchScorecard"));
const MatchReviewNavigator = lazy(() => import("./components/MatchReviewNavigator"));
const ChibiShareCard = lazy(() => import("./components/ChibiShareCard"));
const ChibiFlex = lazy(() => import("./components/ChibiFlex"));
const ChibiIdentity = lazy(() => import("./components/ChibiIdentity"));
const ChibiActionCenter = lazy(() => import("./components/ChibiActionCenter"));
const ChibiToday = lazy(() => import("./components/ChibiToday"));
const StyleShift = lazy(() => import("./components/StyleShift"));
const AskChibi = lazy(() => import("./components/AskChibi"));
const ChibiMemory = lazy(() => import("./components/ChibiMemory"));
const ReviewQueue = lazy(() => import("./components/ReviewQueue"));
const DDragonArt = lazy(() => import("./components/DDragonArt"));
const MatchBoardMap = lazy(() => import("./components/MatchBoardMap"));
const ChibiRecordedBadge = lazy(() => import("./components/ChibiRecordedBadge"));
const GlobalMetaPage = lazy(() => import("./components/GlobalMetaPage"));
const CompsPage = lazy(() => import("./components/CompsPage"));
const StatisticsPage = lazy(() => import("./components/StatisticsPage"));
const TeamBuilderPage = lazy(() => import("./components/TeamBuilderPage"));
const LeaderboardPage = lazy(() => import("./components/LeaderboardPage"));
const OverlayPage = lazy(() => import("./components/OverlayPage"));

function App() {
  const { t, locale } = useI18n();
  const [riotId,setRiotId]=useState("");
  const [demoMode,setDemoMode]=useState(false);
  const [platform,setPlatform]=useState("br1");
  const [profile,setProfile]=useState<TftProfile|null>(null);
  const [matches,setMatches]=useState<TftMatch[]>([]);
  const [loading,setLoading]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState("");
  const [hasMore,setHasMore]=useState(true);
  const [selectedMatch,setSelectedMatch]=useState<TftMatchDetail|null>(null);
  const [matchLoading,setMatchLoading]=useState(false);
  const [matchError,setMatchError]=useState("");
  const [staticData,setStaticData]=useState<TftStaticData|null>(null);
  const [selectedSet,setSelectedSet]=useState<number|null>(null);
  const [selectedQueue,setSelectedQueue]=useState<number|null>(null);
  const [openedMatch,setOpenedMatch]=useState<TftMatch|null>(null);
  const [guidedReviewIds,setGuidedReviewIds]=useState<string[]>([]);
  const [guidedReviewIndex,setGuidedReviewIndex]=useState(0);
  const [evidenceIds,setEvidenceIds]=useState<string[]|null>(null);
  const [evidenceLabel,setEvidenceLabel]=useState("");
  const [journalVersion,setJournalVersion]=useState(0);
  const [profileTab,setProfileTab]=useState<ProfileTab>("matches");
  const [historyFilter,setHistoryFilter]=useState<"all"|"top4"|"bottom2"|"review">("all");
  const [historyDensity,setHistoryDensity]=useState<HistoryDensity>(()=>{
    try{return localStorage.getItem("chibi.history.density")==="detailed"?"detailed":"compact";}catch{return "compact";}
  });
  const [historySort,setHistorySort]=useState<HistorySort>(()=>{
    try{
      const value=localStorage.getItem("chibi.history.sort");
      return value==="placement"||value==="stage"?value:"date";
    }catch{return "date";}
  });
  const [builderPreset,setBuilderPreset]=useState<string[]>([]);
  const [recentPlayers,setRecentPlayers]=useState<RecentPlayer[]>(()=>getRecentPlayers());
  const [studyRequest,setStudyRequest]=useState<StudyRequest|null>(()=>readStudyRequest());
  const [studyOpenedMatchId,setStudyOpenedMatchId]=useState("");
  const [studyLookup,setStudyLookup]=useState<"idle"|"searching"|"unavailable">("idle");
  const studyAttempts=useRef(0);
  const [statsTarget,setStatsTarget]=useState<{
    category:StatisticsCategory;
    query:string;
    view:"stats"|"tier";
  }>({
    category:"champions",
    query:"",
    view:"stats",
  });
  const [compactViewport,setCompactViewport]=useState(()=>isCompactClient());
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [sitePage,setSitePage]=useState<
    "main"|"meta"|"comps"|"stats"|"builder"|"leaderboard"|"overlay"|"about"|"privacy"|"terms"
  >(
    window.location.hash==="#meta"
      ?"meta"
      :window.location.hash==="#comps"
        ?"comps"
        :window.location.hash==="#stats"
          ?"stats"
          :window.location.hash==="#builder"
            ?"builder"
            :window.location.hash==="#leaderboard"
              ?"leaderboard"
              :window.location.hash==="#overlay"
                ?"overlay"
                :window.location.hash==="#about"
                  ?"about"
                  :window.location.hash==="#privacy"
                    ?"privacy"
                    :window.location.hash==="#terms"
                      ?"terms"
                      :"main"
  );

  const staticLoadStarted=useRef(false);
  const ensureStaticData=useCallback(()=>{
    if(staticLoadStarted.current)return;
    staticLoadStarted.current=true;
    void loadTftStaticData().then(setStaticData).catch(()=>{
      // Allow retry after a network outage.
      staticLoadStarted.current=false;
    });
  },[]);

  // Only load optional Data Dragon dictionaries once users need them.
  // Keep direct profile, demo and deep links immediately usable.
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.has("player")||params.get("demo")==="review"||window.location.hash){
      ensureStaticData();
      return;
    }
    const timer=window.setTimeout(ensureStaticData,5000);
    const prepare=()=>{window.clearTimeout(timer);ensureStaticData();};
    window.addEventListener("chibi:prepare-static",prepare);
    return ()=>{
      window.clearTimeout(timer);
      window.removeEventListener("chibi:prepare-static",prepare);
    };
  },[ensureStaticData]);

  useEffect(()=>{
    if(sitePage!=="main"||profile)ensureStaticData();
  },[sitePage,profile,ensureStaticData]);

  useEffect(()=>{
    try{localStorage.setItem("chibi.history.density",historyDensity);}catch{}
  },[historyDensity]);

  useEffect(()=>{
    try{localStorage.setItem("chibi.history.sort",historySort);}catch{}
  },[historySort]);

  useEffect(()=>{
    const mobileMedia=window.matchMedia("(max-width: 820px)");
    const pointerMedia=window.matchMedia("(pointer: coarse)");
    const syncViewport=()=>{
      const next=isCompactClient();
      setCompactViewport(next);
      document.documentElement.classList.toggle("chibi-compact-client",next);
      if(!next)setMobileNavOpen(false);
    };
    syncViewport();
    mobileMedia.addEventListener("change",syncViewport);
    pointerMedia.addEventListener("change",syncViewport);
    window.addEventListener("resize",syncViewport,{passive:true});
    window.addEventListener("orientationchange",syncViewport,{passive:true});
    return ()=>{
      document.documentElement.classList.remove("chibi-compact-client");
      mobileMedia.removeEventListener("change",syncViewport);
      pointerMedia.removeEventListener("change",syncViewport);
      window.removeEventListener("resize",syncViewport);
      window.removeEventListener("orientationchange",syncViewport);
    };
  },[]);

  useEffect(()=>{
    const refreshRecentPlayers=()=>setRecentPlayers(getRecentPlayers());
    window.addEventListener("chibi:recent-players",refreshRecentPlayers);

    const params=new URLSearchParams(window.location.search);
    const player=params.get("player")?.trim();
    const tag=params.get("tag")?.trim();
    const region=(params.get("region")||"br1").toLowerCase();
    const tab=parseProfileTab(params.get("tab"));
    const queueRaw=Number(params.get("queue"));
    const queue=Number.isFinite(queueRaw)&&queueRaw>0?queueRaw:null;
    const setRaw=Number(params.get("set"));
    const setNumber=Number.isFinite(setRaw)&&setRaw>0?setRaw:null;

    if(params.get("demo")==="review"){
      openReviewDemo(tab,queue,setNumber??18,false);
    }else if(player&&tag){
      setRiotId(player+"#"+tag);
      setPlatform(region);
      void loadPlayer(player,tag,region,false,tab,queue,setNumber);
    }
    if(params.get("source")==="native") localStorage.setItem("chibi:opened_from_native","true");

    const onPopState=()=>{
      const nextParams=new URLSearchParams(window.location.search);
      setProfileTab(parseProfileTab(nextParams.get("tab")));
      const raw=Number(nextParams.get("queue"));
      setSelectedQueue(Number.isFinite(raw)&&raw>0?raw:null);
      const setRaw=Number(nextParams.get("set"));
      setSelectedSet(Number.isFinite(setRaw)&&setRaw>0?setRaw:null);
      setStudyRequest(readStudyRequest());
      setStudyOpenedMatchId("");
    };

    const onHashChange=()=>{
      setSitePage(
        window.location.hash==="#meta"
          ?"meta"
          :window.location.hash==="#comps"
            ?"comps"
            :window.location.hash==="#stats"
              ?"stats"
              :window.location.hash==="#builder"
                ?"builder"
                :window.location.hash==="#leaderboard"
                  ?"leaderboard"
                  :window.location.hash==="#overlay"
                    ?"overlay"
                    :window.location.hash==="#about"
                      ?"about"
                      :window.location.hash==="#privacy"
                        ?"privacy"
                        :window.location.hash==="#terms"
                          ?"terms"
                          :"main"
      );
      requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"auto"}));
    };

    window.addEventListener("popstate",onPopState);
    window.addEventListener("hashchange",onHashChange);
    return ()=>{
      window.removeEventListener("popstate",onPopState);
      window.removeEventListener("hashchange",onHashChange);
      window.removeEventListener("chibi:recent-players",refreshRecentPlayers);
    };
  },[]);

  const rank=useMemo(
    ()=>profile?.ranked?.find((r)=>String(r.queueType).toUpperCase()==="RANKED_TFT")
      || profile?.ranked?.find((r)=>String(r.queueType).toUpperCase().includes("RANKED_TFT"))
      || profile?.ranked?.[0]
      || null,
    [profile]
  );

  const availableSets=useMemo(
    ()=>[...new Set(
      matches
        .map(match=>Number(match.setNumber))
        .filter(setNumber=>Number.isFinite(setNumber)&&setNumber>0)
    )].sort((a,b)=>b-a),
    [matches]
  );

  const currentSet=useMemo(()=>{
    if(selectedSet!=null&&availableSets.includes(selectedSet))return selectedSet;
    return availableSets[0]??null;
  },[availableSets,selectedSet]);

  const currentSetMatches=useMemo(()=>{
    if(currentSet==null) return matches;
    const filtered=matches.filter((m)=>Number(m.setNumber)===currentSet);
    return filtered.length ? filtered : matches;
  },[matches,currentSet]);

  const availableQueues=useMemo(
    ()=>[...new Set(
      currentSetMatches
        .map((m)=>Number(m.queueId))
        .filter((q)=>Number.isFinite(q) && q>0)
    )],
    [currentSetMatches]
  );

  const analysisMatches=useMemo(()=>{
    if(selectedQueue==null) return currentSetMatches;
    const filtered=currentSetMatches.filter((m)=>Number(m.queueId)===Number(selectedQueue));
    return filtered.length ? filtered : currentSetMatches;
  },[currentSetMatches,selectedQueue]);

  useEffect(()=>{
    if(selectedQueue!=null||availableQueues.length<=1)return;
    const preferred=availableQueues.includes(1100)?1100:availableQueues[0];
    if(preferred)setSelectedQueue(preferred);
  },[availableQueues,selectedQueue]);


  useEffect(()=>{
    if(!profile||!studyRequest||studyOpenedMatchId===studyRequest.matchId)return;
    const target=matches.find(match=>match.id===studyRequest.matchId);
    if(!target){
      if(studyLookup==="unavailable") return;
      const attempt=studyAttempts.current;
      if(attempt>=3){ setStudyLookup("unavailable"); return; }
      const delay=[0,2000,5000][attempt]||5000;
      setStudyLookup("searching");
      const timer=window.setTimeout(()=>{
        const parsed=splitRiotId(riotId);
        if(!parsed){ setStudyLookup("unavailable"); return; }
        studyAttempts.current+=1;
        fetchTftHistory(parsed.gameName,parsed.tagLine,platform,matches.length,20)
          .then(result=>{
            const next=result.matches||[];
            setMatches(current=>{
              const seen=new Set(current.map(match=>match.id));
              return [...current,...next.filter(match=>!seen.has(match.id))];
            });
            setHasMore(next.length>=20);
            setStudyLookup(next.length?"idle":"searching");
          })
          .catch(()=>setStudyLookup(studyAttempts.current>=3?"unavailable":"idle"));
      },delay);
      return ()=>window.clearTimeout(timer);
    }

    const focus=studyFocusById(studyRequest.focusId);
    setStudyOpenedMatchId(studyRequest.matchId);
    setEvidenceIds([studyRequest.matchId]);
    setEvidenceLabel("Chibi Study · "+focus.label);
    setProfileTab("matches");
    void openMatch(target);
  },[profile,matches,studyRequest,studyOpenedMatchId,studyLookup,riotId,platform]);

  const staticCurrentSet=useMemo(()=>latestTftSetNumber(staticData),[staticData]);
  const isHistoricalSet=Boolean(currentSet&&staticCurrentSet&&currentSet<staticCurrentSet);

  const metaQueueId=useMemo(
    ()=>selectedQueue ?? (availableQueues.length===1 ? availableQueues[0] : null),
    [selectedQueue,availableQueues]
  );

  const dna=useMemo(()=>buildChibiDNA(analysisMatches),[analysisMatches]);

  const headlineStats=useMemo(()=>{
    const total=analysisMatches.length;
    const top4=analysisMatches.filter(match=>match.placement<=4).length;
    const wins=analysisMatches.filter(match=>match.placement===1).length;
    const bottom2=analysisMatches.filter(match=>match.placement>=7).length;
    const avg=dna.avgPlacement;
    const avgLabel=avg==null
      ? t("profile.avg.insufficient")
      : avg<=4
        ? t("profile.avg.above")
        : avg<=4.75
          ? t("profile.avg.near")
          : t("profile.avg.below");

    return {total,top4,wins,bottom2,avgLabel};
  },[analysisMatches,dna.avgPlacement,t]);

  const trendStats=useMemo(()=>{
    if(analysisMatches.length<6) return {label:t("profile.trend.low"),detail:t("profile.trend.load"),tone:""};
    const window=Math.min(3,Math.floor(analysisMatches.length/2));
    const recent=analysisMatches.slice(0,window);
    const previous=analysisMatches.slice(window,window*2);
    const avg=(list:TftMatch[])=>list.reduce((sum,match)=>sum+match.placement,0)/Math.max(1,list.length);
    const recentAvg=avg(recent);
    const previousAvg=avg(previous);
    const delta=recentAvg-previousAvg;
    const detail="Últimas "+window+": "+recentAvg.toFixed(2)+" · "+window+" anteriores: "+previousAvg.toFixed(2)+" · referência Top 4 ≤ 4.00";
    if(delta<=-.45) return {label:t("profile.trend.improving"),detail,tone:"good"};
    if(delta>=.45) return {label:t("profile.trend.worsening"),detail,tone:"warning"};
    return {label:t("profile.trend.stable"),detail,tone:""};
  },[analysisMatches,t]);

  const historyBaseMatches=useMemo(()=>{
    if(!evidenceIds?.length)return analysisMatches;
    const allowed=new Set(evidenceIds);
    return analysisMatches.filter(match=>allowed.has(match.id));
  },[analysisMatches,evidenceIds]);

  const visibleMatches=useMemo(()=>{
    if(historyFilter==="top4") return historyBaseMatches.filter(match=>match.placement<=4);
    if(historyFilter==="bottom2") return historyBaseMatches.filter(match=>match.placement>=7);
    if(historyFilter==="review") return historyBaseMatches.filter(match=>
      match.placement>=7 || (match.placement>=5&&(match.goldLeft>=10||match.level>=8))
    );
    return historyBaseMatches;
  },[historyBaseMatches,historyFilter]);

  const visibleHistorySummary=useMemo(()=>{
    const total=visibleMatches.length;
    const average=total?visibleMatches.reduce((sum,match)=>sum+match.placement,0)/total:null;
    const top4=visibleMatches.filter(match=>match.placement<=4).length;
    const bottom2=visibleMatches.filter(match=>match.placement>=7).length;
    return {total,average,top4,bottom2};
  },[visibleMatches]);

  const historySessions=useMemo(()=>{
    const sorted=historyBaseMatches
      .slice()
      .sort((a,b)=>(b.playedAt||0)-(a.playedAt||0));

    const rawSessions:Array<{matches:TftMatch[];start:number;end:number}> = [];

    for(const match of sorted){
      const playedAt=Number(match.playedAt)||0;
      const current=rawSessions[rawSessions.length-1];

      if(!current){
        rawSessions.push({matches:[match],start:playedAt,end:playedAt});
        continue;
      }

      const previous=current.matches[current.matches.length-1];
      const gap=Math.abs((previous.playedAt||0)-playedAt);

      if(gap>2.5*60*60*1000){
        rawSessions.push({matches:[match],start:playedAt,end:playedAt});
        continue;
      }

      current.matches.push(match);
      current.start=Math.min(current.start||playedAt,playedAt);
      current.end=Math.max(current.end||playedAt,playedAt);
    }

    const visibleIds=new Set(visibleMatches.map(match=>match.id));

    const enriched=rawSessions.map((session,index)=>{
      const games=session.matches.length;
      const average=session.matches.reduce((sum,match)=>sum+match.placement,0)/Math.max(1,games);
      const top4=session.matches.filter(match=>match.placement<=4).length;
      const bottom2=session.matches.filter(match=>match.placement>=7).length;
      const wins=session.matches.filter(match=>match.placement===1).length;

      return {
        ...session,
        displayMatches:session.matches
          .filter(match=>visibleIds.has(match.id))
          .slice()
          .sort((a,b)=>{
            if(historySort==="placement")return a.placement-b.placement||(b.playedAt||0)-(a.playedAt||0);
            if(historySort==="stage")return (Number(b.lastRound)||0)-(Number(a.lastRound)||0)||(b.playedAt||0)-(a.playedAt||0);
            return (b.playedAt||0)-(a.playedAt||0);
          }),
        index,
        games,
        average,
        top4Rate:Math.round(top4/Math.max(1,games)*100),
        bottom2,
        wins,
        delta:null as number|null,
      };
    });

    for(let index=0;index<enriched.length-1;index++){
      enriched[index].delta=+(enriched[index].average-enriched[index+1].average).toFixed(2);
    }

    return enriched.filter(session=>session.displayMatches.length>0);
  },[historyBaseMatches,visibleMatches,historySort]);

  const openedMatchNavigation=useMemo(()=>{
    if(!openedMatch)return {newer:null as TftMatch|null,older:null as TftMatch|null,index:-1};
    const index=analysisMatches.findIndex(match=>match.id===openedMatch.id);
    return {
      index,
      newer:index>0?analysisMatches[index-1]:null,
      older:index>=0&&index<analysisMatches.length-1?analysisMatches[index+1]:null,
    };
  },[openedMatch,analysisMatches]);

  useEffect(()=>{
    if(!openedMatch)return;

    const onKeyDown=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.tagName==="INPUT"||target?.tagName==="TEXTAREA"||target?.tagName==="SELECT")return;

      if(event.key==="Escape"){
        event.preventDefault();
        closeMatchReview();
        return;
      }

      if(event.key==="ArrowLeft"&&openedMatchNavigation.newer&&!matchLoading){
        event.preventDefault();
        void openMatch(openedMatchNavigation.newer);
      }

      if(event.key==="ArrowRight"&&openedMatchNavigation.older&&!matchLoading){
        event.preventDefault();
        void openMatch(openedMatchNavigation.older);
      }
    };

    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[
    openedMatch,
    openedMatchNavigation.newer?.id,
    openedMatchNavigation.older?.id,
    matchLoading,
  ]);

  function updateProfileUrl(
    tab:ProfileTab=profileTab,
    queue:number|null=selectedQueue,
    setNumber:number|null=currentSet,
  ){
    if(!profile) return;
    const url=new URL(window.location.href);

    if(demoMode){
      url.search="";
      url.searchParams.set("demo","review");
      url.searchParams.set("tab",tab);
      if(queue!=null) url.searchParams.set("queue",String(queue));
      if(setNumber!=null) url.searchParams.set("set",String(setNumber));
      url.hash="";
      window.history.replaceState({},"",url.toString());
      return;
    }

    url.searchParams.set("player",profile.player.gameName);
    url.searchParams.set("tag",profile.player.tagLine);
    url.searchParams.set("region",profile.player.platform);
    url.searchParams.set("tab",tab);
    if(queue!=null) url.searchParams.set("queue",String(queue));
    else url.searchParams.delete("queue");
    if(setNumber!=null) url.searchParams.set("set",String(setNumber));
    else url.searchParams.delete("set");
    window.history.replaceState({},"",url.toString());
  }

  function changeProfileTab(tab:ProfileTab){
    setProfileTab(tab);
    updateProfileUrl(tab,selectedQueue,currentSet);
  }

  function changeSet(setNumber:number){
    setSelectedSet(setNumber);
    setSelectedQueue(null);
    setHistoryFilter("all");
    clearEvidence();
    updateProfileUrl(profileTab,null,setNumber);
  }

  function changeQueue(queue:number|null){
    setSelectedQueue(queue);
    clearEvidence();
    updateProfileUrl(profileTab,queue,currentSet);
  }

  function showEvidence(ids:string[],label:string){
    setEvidenceIds(ids);
    setEvidenceLabel(label);
    changeProfileTab("matches");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.getElementById("match-history")?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
  }

  function clearEvidence(){
    setEvidenceIds(null);
    setEvidenceLabel("");
  }

  function openReviewQueue(){
    clearEvidence();
    changeProfileTab("matches");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.getElementById("review-queue")?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
  }

  function showCounterEvidence(ids:string[],label:string){
    setSelectedMatch(null);
    setOpenedMatch(null);
    setMatchError("");
    setGuidedReviewIds([]);
    setGuidedReviewIndex(0);
    showEvidence(ids,label);
  }

  function openReviewDemo(
    initialTab:ProfileTab="matches",
    initialQueue:number|null=null,
    initialSet:number|null=18,
    updateUrl=true,
  ){
    const safeTab:ProfileTab=initialTab==="share"?"matches":initialTab;
    setDemoMode(true);
    setSitePage("main");
    setRiotId("Chibi Review Demo#DEMO");
    setPlatform("br1");
    setProfile(DEMO_PROFILE);
    setMatches(DEMO_PROFILE.matches);
    setLoading(false);
    setLoadingMore(false);
    setError("");
    setHasMore(false);
    setSelectedMatch(null);
    setOpenedMatch(null);
    setMatchError("");
    setSelectedSet(initialSet??18);
    setSelectedQueue(initialQueue);
    setProfileTab(safeTab);
    setHistoryFilter("all");
    setGuidedReviewIds([]);
    setGuidedReviewIndex(0);
    setStudyRequest(null);
    setStudyLookup("idle");
    studyAttempts.current=0;
    clearEvidence();

    if(updateUrl){
      const url=new URL(window.location.href);
      url.search="";
      url.searchParams.set("demo","review");
      url.searchParams.set("tab",safeTab);
      if(initialQueue!=null)url.searchParams.set("queue",String(initialQueue));
      if(initialSet!=null)url.searchParams.set("set",String(initialSet));
      url.hash="";
      window.history.replaceState({},"",url.toString());
    }

    scrollPageTop();
  }

  async function loadPlayer(
    gameName:string,
    tagLine:string,
    region:string,
    updateUrl=true,
    initialTab:ProfileTab="matches",
    initialQueue:number|null=null,
    initialSet:number|null=null,
  ){
    setDemoMode(false);
    setLoading(true);
    setError("");
    setProfile(null);
    setMatches([]);
    setHasMore(true);
    setSelectedMatch(null);
    setOpenedMatch(null);
    setSelectedSet(initialSet);
    setSelectedQueue(initialQueue);
    setProfileTab(initialTab);
    studyAttempts.current=0;
    setStudyLookup("idle");
    clearEvidence();

    try{
      const data=await fetchTftProfile(gameName,tagLine,region);
      setProfile(data);
      setMatches(data.matches || []);
      scrollPageTop();
      setHasMore((data.matches?.length || 0) >= 20);

      const recentRank=data.ranked?.find((row)=>String(row.queueType).toUpperCase()==="RANKED_TFT")
        || data.ranked?.find((row)=>String(row.queueType).toUpperCase().includes("RANKED_TFT"))
        || data.ranked?.[0]
        || null;

      const playerKey=region+":"+(data.player.gameName||gameName)+"#"+(data.player.tagLine||tagLine);
      recordRankSnapshot(playerKey,data.ranked||[]);

      saveRecentPlayer({
        gameName:data.player.gameName||gameName,
        tagLine:data.player.tagLine||tagLine,
        platform:region,
        level:data.player.level||0,
        profileIconId:data.player.profileIconId||0,
        rankLabel:recentRank?recentRank.tier+" "+recentRank.rank:"Sem rank atual",
        leaguePoints:recentRank?recentRank.leaguePoints:null,
        averagePlacement:data.summary?.averagePlacement??null,
        top4Rate:data.summary?.top4Rate??0,
        matches:data.matches?.length||0,
        lastSeen:Date.now(),
      });

      if(updateUrl){
        const url=new URL(window.location.href);
        url.search="";
        url.searchParams.set("player",data.player.gameName||gameName);
        url.searchParams.set("tag",data.player.tagLine||tagLine);
        url.searchParams.set("region",region);
        url.searchParams.set("tab",initialTab);
        if(initialQueue!=null) url.searchParams.set("queue",String(initialQueue));
        else url.searchParams.delete("queue");
        const resolvedSet=initialSet ?? (
          data.matches
            ?.map(match=>Number(match.setNumber))
            .find(setNumber=>Number.isFinite(setNumber)&&setNumber>0)
          ?? null
        );
        if(resolvedSet!=null) url.searchParams.set("set",String(resolvedSet));
        else url.searchParams.delete("set");
        window.history.replaceState({},"",url.toString());
      }
    }catch(err){
      setError(err instanceof Error ? err.message : t("profile.error.player"));
    }finally{
      setLoading(false);
    }
  }

  async function searchPlayer(){
    if(demoMode){
      openReviewDemo(profileTab,selectedQueue,currentSet,true);
      return;
    }
    const parsed=splitRiotId(riotId);
    if(!parsed){
      setError("Use o formato Nome#TAG.");
      return;
    }
    await loadPlayer(parsed.gameName,parsed.tagLine,platform,true);
  }

  async function handleSubmit(event:FormEvent){
    event.preventDefault();
    await searchPlayer();
  }

  async function openRecentPlayer(player:RecentPlayer){
    setRiotId(player.gameName+"#"+player.tagLine);
    setPlatform(player.platform);
    await loadPlayer(player.gameName,player.tagLine,player.platform,true,"matches");
  }

  async function refreshSessionPlayer(){
    if(demoMode){
      openReviewDemo("overview",selectedQueue,currentSet,true);
      return;
    }
    const parsed=splitRiotId(riotId);
    if(!parsed)return;
    await loadPlayer(
      parsed.gameName,
      parsed.tagLine,
      platform,
      true,
      "overview",
      selectedQueue,
      currentSet,
    );
  }

  async function openRecentSession(player:RecentPlayer){
    setRiotId(player.gameName+"#"+player.tagLine);
    setPlatform(player.platform);
    await loadPlayer(player.gameName,player.tagLine,player.platform,true,"overview");
  }

  async function openRecentLesson(player:RecentPlayer){
    setRiotId(player.gameName+"#"+player.tagLine);
    setPlatform(player.platform);
    await loadPlayer(player.gameName,player.tagLine,player.platform,true,"coach");
  }

  function forgetRecentPlayer(player:RecentPlayer){
    setRecentPlayers(removeRecentPlayer(player));
  }

  async function loadMore(){
    if(demoMode) return;
    if(!profile || loadingMore || !hasMore) return;
    const parsed=splitRiotId(riotId);
    if(!parsed) return;

    setLoadingMore(true);
    setError("");

    try{
      const result=await fetchTftHistory(
        parsed.gameName,
        parsed.tagLine,
        platform,
        matches.length,
        20,
      );

      const next=result.matches || [];
      setMatches((current)=>{
        const seen=new Set(current.map((m)=>m.id));
        return [...current,...next.filter((m)=>!seen.has(m.id))];
      });
      setHasMore(next.length >= 20);
    }catch(err){
      setError(err instanceof Error ? err.message : t("profile.error.more"));
    }finally{
      setLoadingMore(false);
    }
  }

  function closeMatchReview(){
    setSelectedMatch(null);
    setOpenedMatch(null);
    setMatchError("");
    setGuidedReviewIds([]);
    setGuidedReviewIndex(0);
    if(studyLookup==="unavailable"){
      setStudyRequest(null);
      setStudyLookup("idle");
    }
  }

  function openGuidedReview(match:TftMatch,queueIds:string[],index:number){
    setGuidedReviewIds(queueIds);
    setGuidedReviewIndex(index);
    void openMatch(match);
  }

  async function openMatch(match:TftMatch){
    setMatchLoading(true);
    setMatchError("");
    setSelectedMatch(null);
    setOpenedMatch(match);

    if(demoMode||isDemoMatchId(match.id)){
      const detail=demoMatchDetail(match.id);
      if(detail){
        setSelectedMatch(detail);
        setMatchLoading(false);
        return;
      }
    }

    try{
      const detail=await fetchTftMatch(match.id);
      setSelectedMatch(detail);
    }catch(err){
      setMatchError(err instanceof Error ? err.message : t("profile.error.match"));
    }finally{
      setMatchLoading(false);
    }
  }

  function retryStudy(){
    studyAttempts.current=0;
    setStudyLookup("idle");
  }

  function markStudyReviewed(){
    if(!profile||!openedMatch)return;
    const playerKey=profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine;
    markMatchReviewed(playerKey,openedMatch.id,true);
  }

  function scrollPageTop(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.scrollTo({top:0,left:0,behavior:"auto"});
    }));
  }

  function completeGuidedReview(){
    if(!profile||!openedMatch) return;

    const playerKey=profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine;
    markMatchReviewed(playerKey,openedMatch.id,true);

    const nextIndex=guidedReviewIndex+1;
    const nextId=guidedReviewIds[nextIndex];
    const nextMatch=nextId
      ? analysisMatches.find(match=>match.id===nextId)
      : null;

    if(nextMatch){
      setGuidedReviewIndex(nextIndex);
      void openMatch(nextMatch);
      return;
    }

    closeMatchReview();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.getElementById("review-queue")?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
  }

  function openMeta(){
    setSitePage("meta");
    if(window.location.hash!=="#meta"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#meta");
    }
    scrollPageTop();
  }

  function openComps(){
    setSitePage("comps");
    if(window.location.hash!=="#comps"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#comps");
    }
    scrollPageTop();
  }

  function openStats(
    category:StatisticsCategory="champions",
    query="",
    view:"stats"|"tier"="stats",
  ){
    setStatsTarget({category,query,view});
    setSitePage("stats");
    if(window.location.hash!=="#stats"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#stats");
    }
    scrollPageTop();
  }

  function openExplorePage(page:"meta"|"comps"|"stats"|"builder"|"overlay"){
    if(page==="meta") return openMeta();
    if(page==="comps") return openComps();
    if(page==="stats") return openStats();
    if(page==="builder") return openBuilder([]);
    return openOverlay();
  }

  async function searchFromGlobal(riotIdValue:string){
    const parsed=splitRiotId(riotIdValue);
    if(!parsed){
      setError("Use o formato Nome#TAG.");
      setSitePage("main");
      return;
    }
    setRiotId(riotIdValue);
    setSitePage("main");
    await loadPlayer(parsed.gameName,parsed.tagLine,platform,true,"matches");
  }

  function openBuilder(championIds:string[]=[]){
    setBuilderPreset(championIds);
    setSitePage("builder");
    if(window.location.hash!=="#builder"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#builder");
    }
    scrollPageTop();
  }

  function openLeaderboard(){
    setSitePage("leaderboard");
    if(window.location.hash!=="#leaderboard"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#leaderboard");
    }
    scrollPageTop();
  }

  function openOverlay(){
    setSitePage("overlay");
    if(window.location.hash!=="#overlay"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#overlay");
    }
    scrollPageTop();
  }

  function openInfoPage(page:"about"|"privacy"|"terms"){
    setSitePage(page);
    const hash="#"+page;
    if(window.location.hash!==hash){
      window.history.pushState({},"",window.location.pathname+window.location.search+hash);
    }
    scrollPageTop();
  }


  function closeExplorePage(){
    setSitePage("main");
    if(window.location.hash){
      window.history.replaceState({},"",window.location.pathname+window.location.search);
    }
    scrollPageTop();
  }

  function showCompEvidence(ids:string[],label:string){
    closeExplorePage();
    requestAnimationFrame(()=>showEvidence(ids,label));
  }

  function resetSearch(){
    setDemoMode(false);
    setSitePage("main");
    setProfile(null);
    setMatches([]);
    setError("");
    setSelectedMatch(null);
    setOpenedMatch(null);
    setMatchError("");
    setProfileTab("matches");
    clearEvidence();

    const url=new URL(window.location.href);
    url.search="";
    url.hash="";
    window.history.replaceState({},"",url.toString());
    scrollPageTop();
  }

  return (
    <div className={"app-shell"+(compactViewport?" compact-layout":"")}>
      <header className="topbar">
        <button className="brand brand-button" onClick={resetSearch}>
          <span className="brand-mark brand-mark-image"><img src={SITE_IMAGES.v2.icon} alt=""/></span>
          <span>chibi<span>.gg</span></span>
        </button>
        {!compactViewport&&<nav className="product-nav" aria-label="Chibi">
          <button className={sitePage==="meta"?"active":""} aria-current={sitePage==="meta"?"page":undefined} onClick={openMeta}><ChibiNavIcon kind="meta"/><span>{t("nav.meta")}</span></button>
          <button className={sitePage==="comps"?"active":""} aria-current={sitePage==="comps"?"page":undefined} onClick={openComps}><ChibiNavIcon kind="comps"/><span>{t("nav.comps")}</span></button>
          <button className={sitePage==="stats"?"active":""} aria-current={sitePage==="stats"?"page":undefined} onClick={()=>openStats()}><ChibiNavIcon kind="statistics"/><span>{t("nav.statistics")}</span></button>
          <button className={"builder-nav-button "+(sitePage==="builder"?"active":"")} aria-current={sitePage==="builder"?"page":undefined} onClick={()=>openBuilder([])}><ChibiNavIcon kind="builder"/><span>{t("nav.builder")}</span></button>
          <button className={sitePage==="leaderboard"?"active":""} aria-current={sitePage==="leaderboard"?"page":undefined} onClick={openLeaderboard}><ChibiNavIcon kind="ranking"/><span>{t("nav.leaderboard")}</span></button>
          <button className={"companion-nav-button "+(sitePage==="overlay"?"active":"")} aria-current={sitePage==="overlay"?"page":undefined} onClick={openOverlay}><ChibiNavIcon kind="companion"/><span>{t("nav.companion")}</span></button>
        </nav>}
        <GlobalSearch
          staticData={staticData}
          recentPlayers={recentPlayers}
          onOpenRecent={(player)=>{void openRecentPlayer(player);}}
          onOpenStats={openStats}
          onSearchPlayer={(value)=>{void searchFromGlobal(value);}}
          onOpenPage={openExplorePage}
          onPrepare={ensureStaticData}
        />
        {compactViewport&&<div className="mobile-product-menu">
          <button
            className="mobile-product-menu-trigger"
            type="button"
            aria-label="Abrir navegação"
            aria-expanded={mobileNavOpen}
            aria-controls="chibi-mobile-nav"
            onClick={()=>setMobileNavOpen(value=>!value)}
          >
            <span>{t("nav.menu")}</span>
            <b>☰</b>
          </button>
          {mobileNavOpen&&<div className="mobile-product-menu-panel" id="chibi-mobile-nav" role="navigation" aria-label={t("nav.menu")}>
            <button className={sitePage==="meta"?"active":""} aria-current={sitePage==="meta"?"page":undefined} onClick={()=>{openMeta();setMobileNavOpen(false);}}><ChibiNavIcon kind="meta"/><span>{t("nav.meta")}</span></button>
            <button className={sitePage==="comps"?"active":""} aria-current={sitePage==="comps"?"page":undefined} onClick={()=>{openComps();setMobileNavOpen(false);}}><ChibiNavIcon kind="comps"/><span>{t("nav.comps")}</span></button>
            <button className={sitePage==="stats"?"active":""} aria-current={sitePage==="stats"?"page":undefined} onClick={()=>{openStats();setMobileNavOpen(false);}}><ChibiNavIcon kind="statistics"/><span>{t("nav.statistics")}</span></button>
            <button className={sitePage==="builder"?"active":""} aria-current={sitePage==="builder"?"page":undefined} onClick={()=>{openBuilder([]);setMobileNavOpen(false);}}><ChibiNavIcon kind="builder"/><span>{t("nav.builder")}</span></button>
            <button className={sitePage==="leaderboard"?"active":""} aria-current={sitePage==="leaderboard"?"page":undefined} onClick={()=>{openLeaderboard();setMobileNavOpen(false);}}><ChibiNavIcon kind="ranking"/><span>{t("nav.leaderboard")}</span></button>
            <button className={sitePage==="overlay"?"active":""} aria-current={sitePage==="overlay"?"page":undefined} onClick={()=>{openOverlay();setMobileNavOpen(false);}}><ChibiNavIcon kind="companion"/><span>{t("nav.companion")}</span></button>
          </div>}
        </div>}
        <div className="topbar-actions">
          <LanguageSwitcher />
          <AccountMenu
            riotGameName={profile?.player.gameName}
            riotTagLine={profile?.player.tagLine}
            riotProfileIcon={profile&&staticData
              ?profileIconUrl(staticData.version,profile.player.profileIconId)
              :undefined}
          />
          <button
            className="ghost-button topbar-help-button"
            onClick={()=>openInfoPage("about")}
            aria-label={t("nav.howItWorks")}
            title={t("nav.howItWorks")}
          >
            <span aria-hidden="true">?</span>
            <b>{t("nav.howItWorks")}</b>
          </button>
        </div>
      </header>

      {!compactViewport&&<>
        <SiteArtworkBackdrop page={sitePage} profileTab={profileTab} hasProfile={Boolean(profile)}/>
        <PointerAura/>
      </>}

      <Suspense fallback={<main className="page-load-fallback" role="status" aria-live="polite">{t("home.loading.title")}</main>}>
      {sitePage==="about"||sitePage==="privacy"||sitePage==="terms" ? (
        <ProductInfoPage
          page={sitePage}
          onBack={closeExplorePage}
          onOpenAbout={()=>openInfoPage("about")}
          onOpenPrivacy={()=>openInfoPage("privacy")}
          onOpenTerms={()=>openInfoPage("terms")}
        />
      ) : sitePage==="meta" ? (
        <GlobalMetaPage
          staticData={staticData}
          hasProfile={Boolean(profile)}
          onBack={closeExplorePage}
          onOpenComps={openComps}
          onOpenStats={()=>openStats()}
          onOpenTier={()=>openStats("champions","","tier")}
        />
      ) : sitePage==="comps" ? (
        <CompsPage
          staticData={staticData}
          matches={analysisMatches}
          hasProfile={Boolean(profile)}
          onBack={closeExplorePage}
          onEvidence={showCompEvidence}
          onOpenBuilder={(unitIds)=>openBuilder(unitIds)}
        />
      ) : sitePage==="stats" ? (
        <StatisticsPage
          staticData={staticData}
          matches={analysisMatches}
          hasProfile={Boolean(profile)}
          onBack={closeExplorePage}
          onEvidence={showCompEvidence}
          initialCategory={statsTarget.category}
          initialQuery={statsTarget.query}
          initialView={statsTarget.view}
        />
      ) : sitePage==="builder" ? (
        <TeamBuilderPage
          staticData={staticData}
          matches={analysisMatches}
          hasProfile={Boolean(profile)}
          onBack={closeExplorePage}
          onEvidence={showCompEvidence}
          initialChampionIds={builderPreset}
        />
      ) : sitePage==="leaderboard" ? (
        <LeaderboardPage
          staticData={staticData}
          onOpenPlayer={(player,region)=>{
            if(!player.gameName||!player.tagLine)return;
            setRiotId(player.gameName+"#"+player.tagLine);
            setPlatform(region);
            setSitePage("main");
            void loadPlayer(player.gameName,player.tagLine,region,true,"matches");
          }}
        />
      ) : sitePage==="overlay" ? (
        <OverlayPage
          hasProfile={Boolean(profile)}
          playerName={profile?.player.gameName||""}
          playerKey={profile?profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine:""}
          matches={analysisMatches}
          onBack={closeExplorePage}
        />
      ) : !profile && studyRequest && loading ? (
        <main className="landing landing-v2 native-review-loading">
          <section className="home-hero-v2">
            <div className="home-hero-copy">
              <div className="eyebrow">CHIBI</div>
              <h1>{t("home.loading.title")}</h1>
              <p>{t("home.loading.subtitle")}</p>
            </div>
          </section>
        </main>
      ) : !profile ? (
        <main className="landing landing-v2">
          <section className="home-hero-v2">
            <div className="home-hero-copy">
              <div className="eyebrow">{t("home.eyebrow")}</div>
              <h1>{t("home.title.line1")}<br/><span>{t("home.title.line2")}</span></h1>
              <p>{t("home.intro")}</p>

              <div className="home-hero-benefits" aria-label={t("home.pathsAria")}>
                <span><i>✓</i> {t("home.benefit.profile")}</span>
                <span><i>✓</i> {t("home.benefit.meta")}</span>
                <span><i>✓</i> {t("home.benefit.builder")}</span>
              </div>

              <form className="search-box home-search-v2" onSubmit={handleSubmit}>
                <select aria-label={t("home.region")} value={platform} onChange={(e)=>setPlatform(e.target.value)}>
                  <option value="br1">BR</option><option value="na1">NA</option><option value="euw1">EUW</option>
                  <option value="eun1">EUNE</option><option value="kr">KR</option><option value="jp1">JP</option>
                  <option value="la1">LAN</option><option value="la2">LAS</option><option value="oc1">OCE</option>
                </select>
                <input id="home-riot-id" value={riotId} onChange={(e)=>setRiotId(e.target.value)} placeholder="Nome#TAG" aria-label="Riot ID"/>
                <button type="submit" disabled={loading}>{loading ? t("home.analyzing") : t("home.searchPlayer")}</button>
              </form>
              <div className="home-search-note">
                <span>{t("home.prototype")}</span>
                <i></i>
                <span>{t("home.searchById")}</span>
                <i></i>
                <span>{t("home.rso")}</span>
              </div>

              <RiotServiceStatus platform={platform}/>

              <button className="home-compliance-link" type="button" onClick={()=>openInfoPage("about")}>
                <span>{t("home.compliance.title")}</span>
                <small>{t("home.compliance.subtitle")}</small>
              </button>

              <button className="home-review-demo-button" type="button" onClick={()=>openReviewDemo()}>
                <strong>{t("home.demo.title")}</strong>
                <small>{t("home.demo.subtitle")}</small>
              </button>

              {error && <div className="lookup-error">{error}</div>}

              {recentPlayers[0]&&<button className="home-last-player" onClick={()=>void openRecentPlayer(recentPlayers[0])}>
                <span className="home-last-player-avatar">
                  {staticData&&recentPlayers[0].profileIconId
                    ?<img src={profileIconUrl(staticData.version,recentPlayers[0].profileIconId)} alt=""/>
                    :recentPlayers[0].gameName.slice(0,1).toUpperCase()}
                </span>
                <span>
                  <small>{t("home.lastSearch")}</small>
                  <strong>{recentPlayers[0].gameName}<em>#{recentPlayers[0].tagLine}</em></strong>
                </span>
                <b>{recentPlayers[0].averagePlacement??"—"} <small>{t("home.average")}</small></b>
              </button>}
            </div>

            <div className="home-hero-visual home-hero-visual-v3" aria-hidden="true">
              <div className="home-hero-orbit home-hero-orbit-one"></div>
              <div className="home-hero-orbit home-hero-orbit-two"></div>
              <div className="home-product-window">
                <AdaptiveArtwork className="home-product-reference-art home-product-reference-v2" src={SITE_IMAGES.v2.frames.landscapeSecondary} alt="" aria-hidden="true" decoding="async"/>
                <div className="home-product-windowbar">
                  <span><i></i><i></i><i></i></span>
                  <small>chibi.gg / player</small>
                  <b>{t("home.postGame")}</b>
                </div>

                <div className="home-product-profile">
                  <div className="home-product-player">
                    <span className="home-product-avatar">
                      {staticData&&recentPlayers[0]?.profileIconId
                        ?<img src={profileIconUrl(staticData.version,recentPlayers[0].profileIconId)} alt=""/>
                        :<img src={SITE_IMAGES.icon} alt=""/>}
                    </span>
                    <div>
                      <small>{t("home.yourProfile")}</small>
                      <strong>{recentPlayers[0]?.gameName||t("home.yourRiotId")}<em>{recentPlayers[0]?"#"+recentPlayers[0].tagLine:""}</em></strong>
                      <span>{recentPlayers[0]?.rankLabel||t("home.searchToStart")}</span>
                    </div>
                  </div>

                  <div className="home-product-kpis">
                    <span><small>{t("home.averageUpper")}</small><strong>{recentPlayers[0]?.averagePlacement??"—"}</strong></span>
                    <span><small>{t("home.top4")}</small><strong>{recentPlayers[0]?recentPlayers[0].top4Rate+"%":"—"}</strong></span>
                    <span><small>{t("home.matchesUpper")}</small><strong>{recentPlayers[0]?.matches??"—"}</strong></span>
                  </div>
                </div>

                <div className="home-product-tabs">
                  <span className="active">{t("home.matchesTab")}</span>
                  <span>{t("home.now")}</span>
                  <span>{t("home.coach")}</span>
                </div>

                <div className="home-product-body">
                  <div className="home-product-coach">
                    <span className="home-product-coach-icon">C</span>
                    <div>
                      <small>CHIBI COACH</small>
                      <strong>{recentPlayers[0]?t("home.historyAction"):t("home.understandImportant")}</strong>
                      <p>{recentPlayers[0]
                        ?t("home.historyActionDesc")
                        :t("home.searchActionDesc")}</p>
                    </div>
                    <b>→</b>
                  </div>

                  <div className="home-product-board">
                    <div className="home-product-board-head">
                      <span>{t("home.boardQuick")}</span>
                      <small>Data Dragon</small>
                    </div>
                    <DDragonArt staticData={staticData} variant="compact" label="Champions do set"/>
                  </div>
                </div>

                <div className="home-product-insights">
                  <article>
                    <small>{t("home.matchesUpper")}</small>
                    <strong>{t("home.seeWhatChanged")}</strong>
                    <span><i></i><i></i><i></i><i></i><i></i></span>
                  </article>
                  <article>
                    <small>{t("home.patterns")}</small>
                    <strong>{t("home.understandSignals")}</strong>
                    <span className="bars"><i></i><i></i><i></i></span>
                  </article>
                  <article>
                    <small>{t("home.nextAction")}</small>
                    <strong>{t("home.knowWhatToTest")}</strong>
                    <b>Coach →</b>
                  </article>
                </div>

                <div className="home-product-footer">
                  <span><i></i> {t("home.playerData")}</span>
                  <span>Meta + Builder + Coach</span>
                </div>
              </div>

              <div className="home-float-card home-float-card-meta">
                <small>META</small>
                <strong>{t("home.currentPatch")}</strong>
                <span>{t("home.compsTraits")}</span>
              </div>

              <div className="home-float-card home-float-card-coach">
                <span className="home-float-icon">✦</span>
                <div><small>COACH</small><strong>{t("home.nextAction")}</strong></div>
              </div>
            </div>
          </section>

          <SectionMarker
            index="01"
            kicker={t("home.section.paths.kicker")}
            title={t("home.section.paths.title")}
            description={t("home.section.paths.desc")}
          />
          <section className="home-paths-v2 home-paths-v3 home-section-paths" aria-label={t("home.pathsAria")}>
            <button onClick={openMeta}>
              <span className="home-path-index"><ChibiNavIcon kind="meta"/><em>01</em></span>
              <div>
                <small>META</small>
                <h2>{t("home.path.meta.title")}</h2>
                <p>{t("home.path.meta.desc")}</p>
              </div>
              <b>→</b>
            </button>

            <button onClick={()=>document.getElementById("home-riot-id")?.focus()}>
              <span className="home-path-index"><ChibiNavIcon kind="profile"/><em>02</em></span>
              <div>
                <small>{t("home.path.game.label")}</small>
                <h2>{t("home.path.game.title")}</h2>
                <p>{t("home.path.game.desc")}</p>
              </div>
              <b>→</b>
            </button>

            <button onClick={()=>openBuilder([])}>
              <span className="home-path-index"><ChibiNavIcon kind="builder"/><em>03</em></span>
              <div>
                <small>BUILDER</small>
                <h2>{t("home.path.builder.title")}</h2>
                <p>{t("home.path.builder.desc")}</p>
              </div>
              <b>→</b>
            </button>
          </section>

          <section className="home-proof-strip" aria-label={t("home.proofAria")}>
            <div><span>01</span><strong>{t("home.proof.1.title")}</strong><small>{t("home.proof.1.desc")}</small></div>
            <div><span>02</span><strong>{t("home.proof.2.title")}</strong><small>{t("home.proof.2.desc")}</small></div>
            <div><span>03</span><strong>{t("home.proof.3.title")}</strong><small>{t("home.proof.3.desc")}</small></div>
            <div><span>04</span><strong>{t("home.proof.4.title")}</strong><small>{t("home.proof.4.desc")}</small></div>
          </section>

          <SectionMarker
            index="02"
            kicker={t("home.section.product.kicker")}
            title={t("home.section.product.title")}
            description={t("home.section.product.desc")}
          />
          <HomeVisualShowcase
            onOpenProfile={()=>document.getElementById("home-riot-id")?.focus()}
            onOpenComps={openComps}
            onOpenStats={()=>openStats("champions")}
            onOpenCoach={()=>openReviewDemo("coach")}
          />

          <HomeMetaPreview
            staticData={staticData}
            onOpenMeta={openMeta}
            onOpenComps={openComps}
            onOpenStats={(category,query="")=>openStats(category,query)}
          />

          <section className="home-builder-v2">
            <div className="home-builder-copy">
              <div className="home-builder-kickerline">
                <span className="home-section-index">04</span>
                <span className="home-builder-kicker">{t("home.builder.kicker")}</span>
              </div>
              <h2>{t("home.builder.title")}</h2>
              <p>{t("home.builder.desc")}</p>
              <button onClick={()=>openBuilder([])}>{t("home.builder.explore")}</button>
            </div>

            <div className="home-builder-demo" aria-hidden="true">
              <div className="home-builder-demo-head">
                <span>BOARD</span>
                <small>{t("home.builder.quickPlanning")}</small>
              </div>
              <div className="home-builder-board">
                {Array.from({length:14}).map((_,index)=><i className={index===3||index===5||index===8||index===10?"filled":""} key={index}></i>)}
              </div>
              <DDragonArt staticData={staticData} variant="compact" label="Champions do set"/>
              <div className="home-builder-demo-footer">
                <span><b>8</b><small>{t("home.builder.level")}</small></span>
                <span><b>32G</b><small>{t("home.builder.planned")}</small></span>
                <span><b>3/3</b><small>Augments</small></span>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="profile-page">
          <button className="back-search" onClick={resetSearch}>{t("profile.newSearch")}</button>
          {demoMode&&<section className="review-demo-banner">
            <div>
              <span>{t("profile.demo.label")}</span>
              <strong>{t("profile.demo.title")}</strong>
              <small>{t("profile.demo.desc")}</small>
            </div>
            <button onClick={resetSearch}>{t("profile.demo.exit")}</button>
          </section>}

          <section className="player-summary-shell player-summary-visual player-summary-compact">
            <AdaptiveArtwork className="player-v2-hud-rail" src={SITE_IMAGES.v2.frames.wide} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
            <AdaptiveArtwork className="player-summary-reference-art player-summary-reference-v2" src={SITE_IMAGES.v2.frames.wideAltSecondary} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
            <div className="player-summary-board-art" aria-hidden="true">
              {analysisMatches[0]?.units.slice(0,5).map((unit,index)=>{
                const entry=staticEntry(staticData?.champions,unit.characterId);
                const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
                return src?<img src={src} alt="" key={unit.characterId+index}/>:null;
              })}
            </div>

            <div className="player-summary-main">
              <div className="player-avatar-wrap">
                <div className="avatar">
                  {staticData&&profile.player.profileIconId
                    ?<img src={profileIconUrl(staticData.version,profile.player.profileIconId)} alt="" onError={(e)=>{e.currentTarget.style.display="none";}}/>
                    :profile.player.gameName.slice(0,1).toUpperCase()}
                </div>
                <span className="player-level-badge" title="Nível da conta TFT">
                  <small>NÍVEL</small>
                  <b>{profile.player.level}</b>
                </span>
              </div>

              <div className="player-summary-copy">
                <div className="eyebrow">{profile.player.platform.toUpperCase()} · {currentSet?"SET "+currentSet:"TFT"}</div>
                {isHistoricalSet&&<div className="historical-set-warning">
                  {t("profile.historicalSet",{current:currentSet||"—",latest:staticCurrentSet||"—"})}
                </div>}
                <h1>{profile.player.gameName}<span className="player-tag">#{profile.player.tagLine}</span></h1>
                <div className="player-rank-line">
                  <strong>{rank ? rank.tier+" "+rank.rank : t("profile.noRank")}</strong>
                  {rank&&<span>{rank.leaguePoints} LP · {rank.wins}V / {rank.losses}D</span>}
                </div>
              </div>
            </div>

            <div className="player-summary-kpis" aria-label={t("profile.pulse.aria")}>
              <article className="player-kpi-card">
                <AdaptiveArtwork className="player-kpi-art" src={SITE_IMAGES.v2.badges.rankAlt} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
                <span>{t("profile.pulse.average")}</span>
                <strong>{dna.avgPlacement==null?"—":dna.avgPlacement.toFixed(2)}</strong>
                <small>{headlineStats.avgLabel}</small>
              </article>
              <article className="player-kpi-card">
                <AdaptiveArtwork className="player-kpi-art" src={SITE_IMAGES.v2.badges.heartAlt} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
                <span>TOP 4</span>
                <strong>{dna.sampleSize?dna.top4Rate+"%":"—"}</strong>
                <small>{t("profile.pulse.top4Detail",{top4:headlineStats.top4,total:headlineStats.total})}</small>
              </article>
              <article className={"player-kpi-card player-kpi-trend "+(trendStats.tone||"neutral")}>
                <AdaptiveArtwork className="player-kpi-art" src={SITE_IMAGES.v2.mascots.scoutAlt} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
                <span>{t("profile.pulse.form")}</span>
                <strong>{trendStats.label}</strong>
                <small>{trendStats.detail}</small>
              </article>
            </div>

            <div className="player-summary-actions">
              <button className="refresh-button" onClick={searchPlayer} disabled={loading}>{demoMode?t("profile.restartDemo"):loading?t("profile.updating"):t("profile.update")}</button>
            </div>

            <div className="player-summary-source">
              <RiotDataBar
                profile={profile}
                matchCount={matches.length}
                contextCount={analysisMatches.length}
                refreshing={loading}
                onRefresh={searchPlayer}
                demo={demoMode}
                compact
              />
            </div>
          </section>

          {error && <div className="profile-error">{error}</div>}

          <ChibiToday
            playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
            matches={analysisMatches}
            staticData={staticData}
            onEvidence={showEvidence}
            onOpenCoach={()=>changeProfileTab("coach")}
            onOpenOverview={()=>changeProfileTab("overview")}
          />

          <nav className="profile-tabs simplified-tabs profile-tabs-clean" aria-label={t("profile.tabsAria")}>
            <div className="profile-tab-list">
              <button className={profileTab==="matches"?"active":""} onClick={()=>changeProfileTab("matches")}>{t("profile.matches")}</button>
              <button className={profileTab==="overview"?"active":""} onClick={()=>changeProfileTab("overview")}>{t("profile.summary")}</button>
              <button className={profileTab==="coach"?"active":""} onClick={()=>changeProfileTab("coach")}>Coach</button>
            </div>
            <div className="profile-tab-actions">
              {!demoMode&&<button className="share-analysis-button" onClick={()=>changeProfileTab("share")}>{t("profile.share")}</button>}
            </div>
          </nav>

          {profileTab==="overview"&&<>
            <ChibiSessionMode
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              refreshing={loading}
              onRefresh={refreshSessionPlayer}
              onEvidence={showEvidence}
            />

            <ActiveGoalStrip
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              onEvidence={showEvidence}
              onOpenCoach={()=>changeProfileTab("coach")}
            />

            <details className="overview-primary-plan">
              <summary>
                <span>
                  <b>{t("actionCenter.title")}</b>
                  <small>{t("today.foot")}</small>
                </span>
                <em>{t("profile.details")}</em>
              </summary>
              <div className="overview-primary-plan-content">
                <ChibiActionCenter
                  playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
                  matches={analysisMatches}
                  onEvidence={showEvidence}
                  onReviewQueue={openReviewQueue}
                />
              </div>
            </details>

            <PlayerEvolution
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              staticData={staticData}
              onEvidence={showEvidence}
            />

            <details className="overview-deep-dive">
              <summary>
                <span><b>{t("profile.deep.title")}</b><small>{t("profile.deep.desc")}</small></span>
                <em>{t("profile.details")}</em>
              </summary>
              <div className="overview-deep-dive-content">
                <ChibiPool
                  matches={analysisMatches}
                  staticData={staticData}
                  onEvidence={showEvidence}
                  onOpenBuilder={openBuilder}
                />
                <ChibiIdentity matches={analysisMatches}/>
                <ChibiInnovations
                  matches={analysisMatches}
                  staticData={staticData}
                  onEvidence={showEvidence}
                />
              </div>
            </details>
          </>}

          {profileTab==="coach"&&<>
            <div className="coach-art-banner coach-art-banner-v2" aria-hidden="true">
              <AdaptiveArtwork className="coach-v2-frame" src={SITE_IMAGES.v2.frames.landscape} alt="" loading="lazy" decoding="async"/>
              <AdaptiveArtwork className="coach-v2-mascot" src={SITE_IMAGES.v2.mascots.board} alt="" loading="lazy" decoding="async"/>
              <span></span>
            </div>
            <ChibiCoachMode />
            <ChibiReview
              matches={analysisMatches}
              staticData={staticData}
              journalVersion={journalVersion}
              onEvidence={showEvidence}
            />

            <ReviewQueue
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              onOpenMatch={openGuidedReview}
            />

            <ChibiSessionPlan
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              staticData={staticData}
              onEvidence={showEvidence}
              onOpenBuilder={openBuilder}
            />

            <details className="coach-strategy-layer">
              <summary>
                <span>
                  <b>{t("profile.coach.more.title")}</b>
                  <small>{t("profile.coach.more.desc")}</small>
                </span>
                <em>{t("profile.coach.more.action")}</em>
              </summary>
              <div className="coach-strategy-content">
                <ChibiLearningPath
                  playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
                  matches={analysisMatches}
                  onEvidence={showEvidence}
                />

                <PersonalVsGlobalMeta
                  matches={analysisMatches}
                  setNumber={currentSet}
                  queueId={metaQueueId}
                  staticData={staticData}
                  onEvidence={showEvidence}
                />

                <ChibiFlex
                  matches={analysisMatches}
                  setNumber={currentSet}
                  queueId={metaQueueId}
                  staticData={staticData}
                  onEvidence={showEvidence}
                  onOpenBuilder={openBuilder}
                />
              </div>
            </details>

            <details className="coach-secondary-panel coach-learning-layer">
              <summary>
                <span>
                  <b>{t("profile.lab.title")}</b>
                  <small>{t("profile.lab.desc")}</small>
                </span>
                <em>{t("profile.explore")}</em>
              </summary>
              <div className="coach-secondary-content">
                <ChibiLearningLab
                  matches={analysisMatches}
                  staticData={staticData}
                  onEvidence={showEvidence}
                  onOpenBuilder={openBuilder}
                />
              </div>
            </details>

            <div className="coach-secondary-stack">

              <details className="coach-secondary-panel">
                <summary>
                  <span>
                    <b>{t("profile.lessons.title")}</b>
                    <small>{t("profile.lessons.desc")}</small>
                  </span>
                  <em>Lessons</em>
                </summary>
                <div className="coach-secondary-content">
                  <ChibiLessons
                    playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
                    onEvidence={showEvidence}
                  />
                </div>
              </details>

              <details className="coach-secondary-panel">
                <summary>
                  <span>
                    <b>{t("profile.journal.title")}</b>
                    <small>{t("profile.journal.desc")}</small>
                  </span>
                  <em>Journal</em>
                </summary>
                <div className="coach-secondary-content">
                  <ChibiJournalPatterns
                    matches={analysisMatches}
                    journalVersion={journalVersion}
                    onEvidence={showEvidence}
                  />
                </div>
              </details>

              <details className="coach-secondary-panel">
                <summary>
                  <span>
                    <b>{t("profile.drill.title")}</b>
                    <small>{t("profile.drill.desc")}</small>
                  </span>
                  <em>Drill</em>
                </summary>
                <div className="coach-secondary-content">
                  <ChibiBoardDrill
                    matches={analysisMatches}
                    staticData={staticData}
                    onEvidence={showCounterEvidence}
                  />
                </div>
              </details>

              <details className="coach-secondary-panel">
                <summary>
                  <span>
                    <b>{t("profile.memory.title")}</b>
                    <small>{t("profile.memory.desc")}</small>
                  </span>
                  <em>Memory</em>
                </summary>
                <div className="coach-secondary-content">
                  <ChibiMemory
                    playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
                    matches={analysisMatches}
                  />
                </div>
              </details>

              <details className="coach-secondary-panel">
                <summary>
                  <span>
                    <b>{t("profile.style.title")}</b>
                    <small>{t("profile.style.desc")}</small>
                  </span>
                  <em>{t("profile.details")}</em>
                </summary>
                <div className="coach-secondary-content coach-secondary-grid">
                  <StyleShift matches={analysisMatches}/>
                  <PatchAdaptation
                    matches={analysisMatches}
                    onEvidence={showEvidence}
                  />
                </div>
              </details>
            </div>
          </>}

          {profileTab==="share"&&<>
            <ChibiShareCard
              profile={profile}
              dna={dna}
              matches={analysisMatches}
              staticData={staticData}
              shareUrl={window.location.href}
            />
            <ChibiStudyShare
              profile={profile}
              matches={analysisMatches}
            />
          </>}

          {profileTab==="matches"&&<>
            <div className="content-grid profile-history-first history-section-marker">
            <section className="panel history history-with-reference" id="match-history">
              <AdaptiveArtwork className="history-reference-art history-reference-v2" src={SITE_IMAGES.v2.frames.wideSecondary} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
              <div className="panel-title profile-history-head">
                <div className="profile-history-titlecopy">
                  <span>{t("profile.history.riot")}</span>
                  <h2>{t("profile.history.title")}</h2>
                  <p>{t("profile.history.section.desc")}</p>
                  <small>{t("profile.history.count",{setCount:analysisMatches.length,set:currentSet??"—",loaded:matches.length})}</small>
                </div>

                <div className="history-head-controls">
                  {availableSets.length>1&&<div className="history-filter-group">
                    <span>SET</span>
                    <div className="history-set-tabs" aria-label={t("profile.history.setsAria")}>
                      {availableSets.map(setNumber=>(
                        <button
                          className={currentSet===setNumber?"active":""}
                          onClick={()=>changeSet(setNumber)}
                          key={setNumber}
                        >Set {setNumber}</button>
                      ))}
                    </div>
                  </div>}

                  <div className="history-filter-group">
                    <span>FILA</span>
                    <div className="queue-tabs history-queue-tabs">
                      {availableQueues.length<=1 ? (
                        availableQueues.map((queueId)=>(
                          <button className="active" disabled key={queueId}>{queueLabel(staticData,queueId)}</button>
                        ))
                      ) : <>
                        <button className={selectedQueue==null?"active":""} onClick={()=>changeQueue(null)}>Todas as filas</button>
                        {availableQueues.map((queueId)=>(
                          <button className={selectedQueue===queueId?"active":""} onClick={()=>changeQueue(queueId)} key={queueId}>
                            {queueLabel(staticData,queueId)}
                          </button>
                        ))}
                      </>}
                    </div>
                  </div>

                  <div className="history-filter-group">
                    <span>RESULTADO</span>
                    <div className="history-filter-tabs">
                      {([
                        ["all","Todos"],
                        ["review",t("profile.history.review")],
                        ["top4","Top 4"],
                        ["bottom2","Bottom 2"],
                      ] as const).map(([id,label])=>(
                        <button
                          className={historyFilter===id?"active":""}
                          onClick={()=>setHistoryFilter(id)}
                          key={id}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  <div className="history-filter-group">
                    <span>VISUAL</span>
                    <div className="history-density-tabs" aria-label="Densidade do histórico">
                      <button className={historyDensity==="compact"?"active":""} onClick={()=>setHistoryDensity("compact")}>Compacto</button>
                      <button className={historyDensity==="detailed"?"active":""} onClick={()=>setHistoryDensity("detailed")}>Detalhado</button>
                    </div>
                  </div>

                  <div className="history-filter-group">
                    <span>ORDEM</span>
                    <div className="history-sort-tabs" aria-label="Ordenar partidas">
                      <button className={historySort==="date"?"active":""} onClick={()=>setHistorySort("date")}>Recentes</button>
                      <button className={historySort==="placement"?"active":""} onClick={()=>setHistorySort("placement")}>Colocação</button>
                      <button className={historySort==="stage"?"active":""} onClick={()=>setHistorySort("stage")}>Estágio</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="history-filter-summary" aria-live="polite">
                <span><b>{visibleHistorySummary.total}</b> partidas visíveis</span>
                <span><b>{visibleHistorySummary.average==null?"—":visibleHistorySummary.average.toFixed(2)}</b> média</span>
                <span><b>{visibleHistorySummary.top4}</b> Top 4</span>
                <span><b>{visibleHistorySummary.bottom2}</b> Bottom 2</span>
                <em>{selectedQueue==null?"Todas as filas":queueLabel(staticData,selectedQueue)}</em>
              </div>

              {evidenceIds?.length&&<div className="evidence-banner">
                <div>
                  <span>{t("profile.history.activeEvidence")}</span>
                  <strong>{evidenceLabel}</strong>
                  <small>{t("profile.history.relatedCount",{count:visibleMatches.length})}</small>
                </div>
                <button onClick={clearEvidence}>{t("profile.history.fullContext")}</button>
              </div>}

              <div className={"match-list match-list-v2 match-session-list history-density-"+historyDensity}>
                {!visibleMatches.length&&<div className="history-empty-filter">
                  {t("profile.history.empty")}
                </div>}

                {historySessions.map((session)=>(
                  <section className="history-session-group" key={(session.end||session.index)+":"+session.index}>
                    <header className="history-session-head history-session-head-compact">
                      <div className="history-session-titleline">
                        <span>{t("profile.history.session")} {historySessions.length>1?historySessions.length-session.index:t("profile.history.current")}</span>
                        <strong>{formatDay(session.end,locale)} · {formatClock(session.start,locale)}–{formatClock(session.end,locale)}</strong>
                        <small>{t("profile.history.games",{count:session.games})}</small>
                        {session.wins>0&&<small>{t("profile.history.wins",{count:session.wins})}</small>}
                        {session.delta!=null&&Math.abs(session.delta)>.25&&<em
                          className={session.delta<0?"better":"worse"}
                          title={"Variação da colocação média em relação à sessão anterior. Menor é melhor."}
                        >
                          {session.delta<0
                            ? "Média melhorou "+Math.abs(session.delta).toFixed(2)+" vs sessão anterior"
                            : "Média piorou "+Math.abs(session.delta).toFixed(2)+" vs sessão anterior"}
                        </em>}
                      </div>

                      <div className="history-session-stats">
                        <span><small>MÉDIA</small><b>{session.average.toFixed(2)}</b></span>
                        <span><small>TOP 4</small><b>{session.games<8
                          ? session.displayMatches.filter(match=>match.placement<=4).length+"/"+session.games
                          : session.top4Rate+"%"}</b></span>
                        <span className={session.bottom2>0?"warning":""}><small>BOTTOM 2</small><b>{session.bottom2}</b></span>
                      </div>
                    </header>

                    <div className="history-session-games">
                      {session.displayMatches.map((match)=>{
                        const cue=matchReviewCue(match,t);
                        const threeStarCount=match.units.filter(unit=>unit.tier>=3).length;
                        const equippedItemCount=match.units.reduce((sum,unit)=>sum+unit.itemNames.length,0);
                        const resultBand=placementBand(match.placement);
                        return <article className={"match-row match-row-v2 cue-"+cue.tone+" placement-band-"+resultBand} key={match.id}>
                          <div className="match-result-rail">
                            <MatchResultAccent placement={match.placement}/>
                            <TacticianVisual companion={match.companion} staticData={staticData}/>
                            <div className={"placement "+placementClass(match.placement)}>{match.placement}º</div>
                          </div>

                          <div className="match-main">
                            <div className="match-context-line">
                              <b className="data-origin-badge riot">RIOT</b>
                              <span className="match-context-chip">{queueLabel(staticData,match.queueId||0)}</span>
                              {matchRoundLabel(match)&&<span className="match-context-chip">{matchRoundLabel(match)}</span>}
                              {match.duration&&<span className="match-context-chip">{formatDuration(match.duration)}</span>}
                              <span className="match-context-chip">{formatClock(match.playedAt,locale)}</span>
                              {match.hasChibiTelemetry&&<ChibiRecordedBadge status={match.chibiTelemetryStatus}/>}
                            </div>

                            <div className="match-row-title">
                              <div>
                                <strong>{activeTraits(match).slice(0,2).map((t)=>traitLabel(t,staticData)).filter(Boolean).join(" · ") || "Board TFT"}</strong>
                                <span
                                  className={"match-review-label "+cue.tone}
                                  title={cue.title}
                                >{cue.label}</span>
                              </div>
                            </div>

                            <div className={"match-review-inline "+cue.tone}>
                              <b className="data-origin-badge chibi">CHIBI</b>
                              <strong>{cue.title}</strong>
                            </div>

                            <details className="match-history-details" open={historyDensity==="detailed"?true:undefined}>
                              <summary>
                                <span>Board, campeões e itens</span>
                                <small>{match.units.length} unidades · {equippedItemCount} itens</small>
                              </summary>
                              <div className="match-lineup match-lineup-grouped">
                              {(()=>{
                                const historyTraits=activeTraits(match).slice(0,3);
                                const groupedIds=new Set(
                                  historyTraits.flatMap((trait)=>
                                    match.units
                                      .filter((unit)=>unitHasTrait(unit,trait,staticData))
                                      .map((unit)=>unit.characterId)
                                  )
                                );
                                const otherUnits=match.units.filter((unit)=>!groupedIds.has(unit.characterId));

                                return <>
                                  <div className="match-history-class-groups" aria-label="Campeões organizados por sinergia">
                                    {historyTraits.map((trait)=>{
                                      const entry=staticEntry(staticData?.traits,trait.name);
                                      const image=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
                                      const label=traitLabel(trait,staticData);
                                      const relatedUnits=match.units.filter((unit)=>unitHasTrait(unit,trait,staticData));

                                      if(!relatedUnits.length)return null;

                                      return <section className={"match-history-class-group style-"+Math.max(0,trait.style)} key={trait.name}>
                                        <header className="match-history-class-head">
                                          <span className="match-history-class-icon" aria-hidden="true">
                                            <span>{label.slice(0,1)}</span>
                                            {image&&<img src={image} alt="" onError={(e)=>{e.currentTarget.style.display="none";}}/>}
                                          </span>
                                          <span className="match-history-class-copy">
                                            <strong>{label}</strong>
                                            <small>{relatedUnits.length} {relatedUnits.length===1?"campeão":"campeões"}</small>
                                          </span>
                                          <b>{trait.numUnits}</b>
                                        </header>

                                        <div className="match-history-class-units">
                                          {relatedUnits.map((unit,index)=>(
                                            <UnitVisual
                                              unit={unit}
                                              staticData={staticData}
                                              compact
                                              showName
                                              key={trait.name+"-"+unit.characterId+"-"+index}
                                            />
                                          ))}
                                        </div>
                                      </section>;
                                    })}

                                    {otherUnits.length>0&&<section className="match-history-class-group match-history-class-group-other">
                                      <header className="match-history-class-head">
                                        <span className="match-history-class-icon" aria-hidden="true">+</span>
                                        <span className="match-history-class-copy">
                                          <strong>Outros do board</strong>
                                          <small>fora das principais</small>
                                        </span>
                                        <b>{otherUnits.length}</b>
                                      </header>

                                      <div className="match-history-class-units">
                                        {otherUnits.map((unit,index)=>(
                                          <UnitVisual
                                            unit={unit}
                                            staticData={staticData}
                                            compact
                                            showName
                                            key={"other-"+unit.characterId+"-"+index}
                                          />
                                        ))}
                                      </div>
                                    </section>}
                                  </div>

                                  {match.augments.length>0&&<div className="match-history-grouped-augments" aria-label={t("profile.history.augmentsAria")}>
                                    <span>AUG</span>
                                    {match.augments.slice(0,3).map((augment)=>(
                                      <AugmentIcon id={augment} staticData={staticData} key={augment}/>
                                    ))}
                                  </div>}
                                </>;
                              })()}
                              </div>
                            </details>
                          </div>

                          <div className="match-meta match-meta-rich">
                            <div className="match-scan-facts match-scan-facts-rail" aria-label="Resumo visual da composição">
                              <span title={t("profile.history.unitsAria",{count:match.units.length})}><i>U</i><b>{match.units.length}</b></span>
                              <span title={t("profile.history.augmentsAria")}><i>AUG</i><b>{match.augments.length}</b></span>
                              <span title={t("stats.category.items")+": "+equippedItemCount}><i>IT</i><b>{equippedItemCount}</b></span>
                              {threeStarCount>0&&<span className="three-star" title={t("reviewQueue.signal.threeStar")+": "+threeStarCount}><i>3★</i><b>{threeStarCount}</b></span>}
                            </div>
                            <div className="match-value-grid match-value-grid-core">
                              <span title="Estimativa do valor das unidades do board final baseada no custo e nas estrelas. Não inclui valor dos itens, economia gasta, posição, shop ou força real de combate."><b>~{boardValue(match,staticData)}G</b><small>{t("profile.history.boardEstimate")}</small></span>
                              <span><b>{match.goldLeft}G</b><small>{t("profile.history.gold")}</small></span>
                              <span><b>Nv {match.level}</b><small>{t("profile.history.level")}</small></span>
                            </div>
                            <button type="button" className="match-meta-open-analysis" onClick={()=>void openMatch(match)}>{t("profile.history.openAnalysis")} <b>→</b></button>
                          </div>
                        </article>;
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {!evidenceIds?.length&&hasMore && <button className="load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? t("profile.history.loadingMore") : t("profile.history.loadMore")}</button>}
            </section>

          </div>

          </>}
          <AskChibi
            playerName={profile.player.gameName}
            playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
            matches={analysisMatches}
            onEvidence={showEvidence}
          />
        </main>
      )}

      <footer className="site-footer">
        <div className="site-footer-main">
          <div>
            <strong>chibi.gg</strong>
            <span>{t("profile.footer.tagline")}</span>
          </div>
          <nav aria-label={t("profile.footer.aria")}>
            <a href={import.meta.env.BASE_URL+"about.html"}>{t("legal.about")}</a>
            <a href={import.meta.env.BASE_URL+"privacy.html"}>{t("legal.privacy")}</a>
            <a href={import.meta.env.BASE_URL+"terms.html"}>{t("legal.terms")}</a>
            <a href={import.meta.env.BASE_URL+"meta-tft.html"}>Guia Meta TFT</a>
            <a href={import.meta.env.BASE_URL+"composicoes-tft.html"}>Guia Composições</a>
            <a href={import.meta.env.BASE_URL+"historico-tft.html"}>Guia Histórico</a>
            <a href={import.meta.env.BASE_URL+"builder-tft.html"}>Guia Builder</a>
            <a href="https://github.com/HelioConde/chibi.gg" target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
        </div>
        <p className="site-footer-riot">Chibi.gg isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      </footer>

      {(matchLoading || selectedMatch || matchError || studyLookup==="unavailable") && (
        <div className="match-overlay" onClick={closeMatchReview}>
          <section className="match-modal match-modal-with-hud" onClick={(e)=>e.stopPropagation()}>
            <img className="match-modal-hud-art match-modal-hud-v2" src={SITE_IMAGES.v2.hud[3]} alt="" aria-hidden="true"/>
            <button className="match-close" onClick={closeMatchReview} aria-label="Fechar revisão da partida" title="Fechar revisão da partida">×</button>
            {matchLoading && <div className="match-state">{t("match.loading")}</div>}
            {matchError && <div className="match-state error">{matchError}</div>}
            {studyLookup==="unavailable"&&!selectedMatch&&!matchLoading&&<div className="match-state error">
              <h2>{t("match.unavailable.title")}</h2>
              <p>{t("match.unavailable.desc")}</p>
              <div className="study-retry-actions">
                <button onClick={retryStudy}>{t("match.retry")}</button>
                <button className="secondary" onClick={closeMatchReview}>{t("match.viewProfile")}</button>
              </div>
            </div>}

            {selectedMatch && <>
              {openedMatch&&studyRequest?.matchId===openedMatch.id&&(()=>{
                const focus=studyFocusById(studyRequest.focusId);
                return <div className="study-match-banner">
                  <div>
                    <span>{studyRequest.source==="native"?"CHIBI COMPANION":"CHIBI STUDY"}</span>
                    <strong>{focus.question}</strong>
                    <small>{focus.hint}</small>
                    {studyRequest.sessionFocus&&<small>{t("match.sessionFocus")} · {sessionFocusLabel(studyRequest.sessionFocus,t)}</small>}
                  </div>
                  {studyRequest.note&&<blockquote>{studyRequest.note}</blockquote>}
                  {studyRequest.reply&&<div className="study-reply-inline">
                    <span>{t("match.reply")} {studyRequest.reviewer?"· "+studyRequest.reviewer:""}</span>
                    <p>{studyRequest.reply}</p>
                  </div>}
                </div>;
              })()}
              <div className="match-modal-head">
                <div>
                  <span>{t("match.review")}</span>
                  <h2>{openedMatch ? matchReviewCue(openedMatch,t).title : displaySetName(selectedMatch.match.setName,selectedMatch.match.setNumber)}</h2>
                  <p>
                    {displaySetName(selectedMatch.match.setName,selectedMatch.match.setNumber)}
                    {" · "}{queueLabel(staticData,selectedMatch.match.queueId)}
                    {" · "}{formatWhen(selectedMatch.match.playedAt,locale,t)}
                    {" · "}{demoMode?t("match.synthetic"):"Riot Match API"}
                    {!demoMode&&selectedMatch.source?.cache==="hit"?" · cache":""}
                  </p>
                </div>
                {openedMatch&&<div className="match-modal-head-actions">
                  <div className="match-modal-nav" title={t("match.navTitle")}>
                    <button
                      disabled={!openedMatchNavigation.newer||matchLoading}
                      onClick={()=>openedMatchNavigation.newer&&void openMatch(openedMatchNavigation.newer)}
                    >{t("match.newer")}</button>
                    <span>{openedMatchNavigation.index>=0?openedMatchNavigation.index+1:"—"} / {analysisMatches.length}</span>
                    <button
                      disabled={!openedMatchNavigation.older||matchLoading}
                      onClick={()=>openedMatchNavigation.older&&void openMatch(openedMatchNavigation.older)}
                    >{t("match.older")}</button>
                  </div>
                  <div className={"match-modal-placement-wrap placement-band-"+placementBand(openedMatch.placement)}>
                    <MatchResultAccent placement={openedMatch.placement} className="match-modal-result-art"/>
                    <div className={"modal-placement "+placementClass(openedMatch.placement)}>{openedMatch.placement}º</div>
                  </div>
                </div>}
              </div>

              {openedMatch&&<section className={"match-summary-card match-summary-card-v2 placement-band-"+placementBand(openedMatch.placement)}>
                <MatchResultAccent placement={openedMatch.placement} className="match-summary-result-art"/>
                <div className="match-summary-main">
                  <span>{t("match.finalBoard")}</span>
                  {(()=>{
                    const summaryTraits=activeTraits(openedMatch).slice(0,4);
                    const sortedUnits=[...openedMatch.units].sort((a,b)=>{
                      const byTrait=unitTraitPriority(a,summaryTraits,staticData)-unitTraitPriority(b,summaryTraits,staticData);
                      if(byTrait!==0)return byTrait;
                      const byTier=(b.tier||0)-(a.tier||0);
                      if(byTier!==0)return byTier;
                      const aName=staticEntry(staticData?.champions,a.characterId)?.name||cleanName(a.characterId);
                      const bName=staticEntry(staticData?.champions,b.characterId)?.name||cleanName(b.characterId);
                      return aName.localeCompare(bName,locale);
                    });

                    return <>
                      <h3 className="match-comp-title" aria-label="Sinergias principais da composição">
                        {summaryTraits.slice(0,2).length
                          ? summaryTraits.slice(0,2).map((trait,index)=>{
                              const entry=staticEntry(staticData?.traits,trait.name);
                              const image=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
                              const label=traitLabel(trait,staticData);
                              return <span className="match-comp-title-node" key={trait.name}>
                                {index>0&&<span className="match-comp-title-separator" aria-hidden="true">·</span>}
                                <span className={"match-comp-title-icon style-"+Math.max(0,trait.style)} aria-hidden="true">
                                  <span>{label.slice(0,1)}</span>
                                  {image&&<img src={image} alt="" onError={(e)=>{e.currentTarget.style.display="none";}}/>}
                                </span>
                                <strong>{label}</strong>
                              </span>;
                            })
                          : "Board TFT"}
                      </h3>

                      <div className="match-trait-groups" aria-label="Campeões organizados por sinergia">
                        {summaryTraits.map((trait)=>{
                          const entry=staticEntry(staticData?.traits,trait.name);
                          const image=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
                          const label=traitLabel(trait,staticData);
                          const relatedUnits=sortedUnits.filter((unit)=>unitHasTrait(unit,trait,staticData));

                          if(!relatedUnits.length)return null;

                          return <section className={"match-trait-group style-"+Math.max(0,trait.style)} key={trait.name}>
                            <header className="match-trait-group-head">
                              <span className="match-trait-group-icon" aria-hidden="true">
                                <span>{label.slice(0,1)}</span>
                                {image&&<img src={image} alt="" onError={(e)=>{e.currentTarget.style.display="none";}}/>}
                              </span>
                              <div>
                                <strong>{label}</strong>
                                <small>{relatedUnits.length} {relatedUnits.length===1?"campeão":"campeões"} no seu board</small>
                              </div>
                              <b>{trait.numUnits}</b>
                            </header>

                            <div className="match-trait-group-connector" aria-hidden="true">
                              <span/>
                            </div>

                            <div className="match-trait-group-units">
                              {relatedUnits.map((unit,index)=>(
                                <UnitVisual
                                  unit={unit}
                                  staticData={staticData}
                                  compact
                                  showName
                                  key={trait.name+"-"+unit.characterId+"-"+index}
                                />
                              ))}
                            </div>
                          </section>;
                        })}

                        {(()=>{
                          const groupedIds=new Set(
                            summaryTraits.flatMap((trait)=>
                              sortedUnits
                                .filter((unit)=>unitHasTrait(unit,trait,staticData))
                                .map((unit)=>unit.characterId)
                            )
                          );
                          const remaining=sortedUnits.filter((unit)=>!groupedIds.has(unit.characterId));
                          if(!remaining.length)return null;
                          return <section className="match-trait-group match-trait-group-other">
                            <header className="match-trait-group-head">
                              <span className="match-trait-group-icon" aria-hidden="true">+</span>
                              <div>
                                <strong>Outros do board</strong>
                                <small>unidades fora das 4 sinergias principais acima</small>
                              </div>
                              <b>{remaining.length}</b>
                            </header>
                            <div className="match-trait-group-units">
                              {remaining.map((unit,index)=>(
                                <UnitVisual
                                  unit={unit}
                                  staticData={staticData}
                                  compact
                                  showName
                                  key={"other-"+unit.characterId+"-"+index}
                                />
                              ))}
                            </div>
                          </section>;
                        })()}
                      </div>

                    </>;
                  })()}
                  {openedMatch.augments.length>0&&<div className="augment-row match-summary-augments">
                    {openedMatch.augments.slice(0,3).map((augment)=><AugmentVisual id={augment} staticData={staticData} key={augment}/>)}
                  </div>}
                </div>
                <div className="match-summary-stats">
                  <span><small>{t("match.level")}</small><b>{openedMatch.level}</b></span>
                  <span><small>STAGE</small><b>{matchRoundLabel(openedMatch)||"—"}</b></span>
                  <span><small>{t("match.damage")}</small><b>{selectedMatch.match.participants.some(player=>player.damageToPlayers>0)?openedMatch.damageToPlayers:"—"}</b></span>
                  <span><small>{t("match.eliminations")}</small><b>{selectedMatch.match.participants.some(player=>(player.playersEliminated||0)>0)?(openedMatch.playersEliminated||0):"—"}</b></span>
                  <span><small>{t("match.gold")}</small><b>{openedMatch.goldLeft}g</b></span>
                  <span><small>{t("match.duration")}</small><b>{formatDuration(selectedMatch.match.duration)}</b></span>
                </div>
              </section>}

              {openedMatch&&<MatchReviewNavigator placement={openedMatch.placement}/>}

              {openedMatch&&<section className="match-review-stage" id="match-review-read">
                <MatchReviewOverview
                  target={openedMatch}
                  detail={selectedMatch}
                />
              </section>}

              {openedMatch&&studyRequest?.matchId===openedMatch.id&&<ChibiStudyReply
                playerName={profile?.player.gameName||t("match.player")}
                existingReply={studyRequest.reply}
              />}

              {openedMatch&&<section className="match-review-stage" id="match-review-why">
                <LobbyAutopsy
                  target={openedMatch}
                  detail={selectedMatch}
                  staticData={staticData}
                />
              </section>}

              {openedMatch&&<section className="match-review-stage" id="match-review-board">
                <MatchBoardMap
                  match={openedMatch}
                  staticData={staticData}
                />
              </section>}

              {openedMatch&&<section className="match-review-more" id="match-review-more">
                <div className="match-review-more-head">
                  <span>ANÁLISE COMPLETA</span>
                  <strong>Abra somente o detalhe que você quer investigar</strong>
                  <small>Comparações secundárias ficam recolhidas para a revisão continuar rápida.</small>
                </div>

                <details className="match-detail-layer match-story-layer">
                  <summary><span><b>História do snapshot</b><small>O que funcionou, o que puniu e qual diferença apareceu</small></span><em>Story</em></summary>
                  <MatchStory
                    target={openedMatch}
                    detail={selectedMatch}
                  />
                </details>

                <details className="match-detail-layer match-scorecard-layer">
                  <summary><span><b>Scorecard da lobby</b><small>Board, upgrades, itens e nível contra os outros jogadores</small></span><em>4 métricas</em></summary>
                  <MatchScorecard
                    target={openedMatch}
                    detail={selectedMatch}
                  />
                </details>

                <details className="match-detail-layer counter-layer">
                  <summary><span><b>{t("match.compare.title")}</b><small>{t("match.compare.desc")}</small></span><em>Counterfactual</em></summary>
                  <BoardCounterfactual
                    target={openedMatch}
                    history={analysisMatches}
                    staticData={staticData}
                    onEvidence={showCounterEvidence}
                  />
                </details>

                <details className="match-detail-layer">
                  <summary><span><b>{t("match.context.title")}</b><small>{t("match.context.desc")}</small></span><em>Journal</em></summary>
                  <MatchJournal
                    matchId={openedMatch.id}
                    placement={openedMatch.placement}
                    playerKey={profile?profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine:""}
                    target={openedMatch}
                    detail={selectedMatch}
                    onSaved={()=>setJournalVersion((value)=>value+1)}
                  />
                </details>
              </section>}

              <details className="match-detail-layer lobby-layer">
                <summary><span><b>{t("match.lobby.title")}</b><small>{t("match.lobby.desc")}</small></span><em>{t("match.players",{count:selectedMatch.match.participants.length})}</em></summary>
                <div className="lobby-list">
                  {selectedMatch.match.participants.slice().sort((a,b)=>a.placement-b.placement).map((participant,index)=>(
                    <article className={"lobby-player "+(openedMatch?.placement===participant.placement?"current-player":"")} key={index}>
                      <div className={"placement "+placementClass(participant.placement)}>{participant.placement}º</div>
                      <div className="lobby-board">
                        <div className="lobby-title">
                          <strong>{t("match.level")} {participant.level}</strong>
                          {openedMatch?.placement===participant.placement&&<span>{t("match.you")}</span>}
                        </div>
                        <div className="trait-row lobby-traits">
                          {participant.traits
                            .filter((t)=>t.numUnits>0&&(t.style>0||t.numUnits>=2))
                            .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
                            .slice(0,4)
                            .map((trait)=><span className="trait-chip" key={trait.name}>{traitLabel(trait,staticData)} {trait.numUnits}</span>)}
                        </div>
                        <div className="board-row detailed">
                          {participant.units.map((unit,unitIndex)=><UnitVisual unit={unit} staticData={staticData} key={unit.characterId+unitIndex}/>)}
                        </div>
                        <div className="augment-row">
                          {participant.augments.slice(0,3).map((augment)=><AugmentVisual id={augment} staticData={staticData} key={augment}/>)}
                        </div>
                      </div>
                      <div className="lobby-meta">
                        <strong>{selectedMatch.match.participants.some(player=>player.damageToPlayers>0)?t("match.damageValue",{value:participant.damageToPlayers}):t("match.damageNA")}</strong>
                        <span>{participant.goldLeft}g</span>
                      </div>
                    </article>
                  ))}
                </div>
              </details>

              {openedMatch&&guidedReviewIds.length>0&&<section className="guided-review-footer">
                <div>
                  <span>{t("match.queue")}</span>
                  <strong>{guidedReviewIndex+1} de {guidedReviewIds.length}</strong>
                  <small>{guidedReviewIndex+1<guidedReviewIds.length
                    ?t("match.queueNext")
                    :t("match.queueLast")}</small>
                </div>
                <div className="guided-review-actions">
                  <button className="secondary" onClick={closeMatchReview}>{t("match.exitQueue")}</button>
                  <button onClick={completeGuidedReview}>
                    {guidedReviewIndex+1<guidedReviewIds.length
                      ?t("match.markNext")
                      :t("match.markDone")}
                  </button>
                </div>
              </section>}
              {openedMatch&&studyRequest?.matchId===openedMatch.id&&<section className="guided-review-footer native-review-completion">
                <div>
                  <span>{t("match.nextMatch")}</span>
                  <strong>{studyRequest.sessionFocus ? t("match.focus",{focus:sessionFocusLabel(studyRequest.sessionFocus,t)}) : t("match.takeAction")}</strong>
                  <small>{t("match.focusDisclaimer")}</small>
                </div>
                <div className="guided-review-actions">
                  <button onClick={markStudyReviewed}>{t("match.markReviewed")}</button>
                </div>
              </section>}
            </>}
          </section>
        </div>
      )}
      </Suspense>
    </div>
  );
}

export default App;
