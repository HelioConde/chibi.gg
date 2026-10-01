import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { buildRankedReviewSignals } from "./analysis/chibiReviewRanking";
import ChibiInnovations from "./components/ChibiInnovations";
import ChibiReview from "./components/ChibiReview";
import ChibiSessionPlan from "./components/ChibiSessionPlan";
import ActiveGoalStrip from "./components/ActiveGoalStrip";
import ChibiLearningLab from "./components/ChibiLearningLab";
import ChibiLearningPath from "./components/ChibiLearningPath";
import ChibiBoardDrill from "./components/ChibiBoardDrill";
import ChibiJournalPatterns from "./components/ChibiJournalPatterns";
import ChibiLessons from "./components/ChibiLessons";
import ChibiCoachMode from "./components/ChibiCoachMode";
import ChibiStudyShare, { studyFocusById } from "./components/ChibiStudyShare";
import ChibiStudyReply from "./components/ChibiStudyReply";
import MatchJournal from "./components/MatchJournal";
import PatchAdaptation from "./components/PatchAdaptation";
import BoardCounterfactual from "./components/BoardCounterfactual";
import LobbyAutopsy from "./components/LobbyAutopsy";
import MatchScorecard from "./components/MatchScorecard";
import MatchReviewOverview from "./components/MatchReviewOverview";
import MatchReviewNavigator from "./components/MatchReviewNavigator";
import MatchStory from "./components/MatchStory";
import ChibiShareCard from "./components/ChibiShareCard";
import PersonalVsGlobalMeta from "./components/PersonalVsGlobalMeta";
import ChibiFlex from "./components/ChibiFlex";
import ChibiIdentity from "./components/ChibiIdentity";
import ChibiPool from "./components/ChibiPool";
import ChibiActionCenter from "./components/ChibiActionCenter";
import ChibiToday from "./components/ChibiToday";
import ChibiSessionMode from "./components/ChibiSessionMode";
import StyleShift from "./components/StyleShift";
import GlobalMetaPage from "./components/GlobalMetaPage";
import CompsPage from "./components/CompsPage";
import OverlayPage from "./components/OverlayPage";
import StatisticsPage, { StatisticsCategory } from "./components/StatisticsPage";
import GlobalSearch from "./components/GlobalSearch";
import HomeMetaPreview from "./components/HomeMetaPreview";
import HomeSessionResume from "./components/HomeSessionResume";
import HomeStudyShelf from "./components/HomeStudyShelf";
import HomeVisualShowcase from "./components/HomeVisualShowcase";
import SiteArtworkBackdrop from "./components/SiteArtworkBackdrop";
import AdaptiveArtwork from "./components/AdaptiveArtwork";
import TeamBuilderPage from "./components/TeamBuilderPage";
import LeaderboardPage from "./components/LeaderboardPage";
import ProductInfoPage from "./components/ProductInfoPage";
import AskChibi from "./components/AskChibi";
import ChibiMemory from "./components/ChibiMemory";
import ReviewQueue from "./components/ReviewQueue";
import PlayerEvolution from "./components/PlayerEvolution";
import DDragonArt from "./components/DDragonArt";
import MatchBoardMap from "./components/MatchBoardMap";
import RiotServiceStatus from "./components/RiotServiceStatus";
import RiotDataBar from "./components/RiotDataBar";
import ChibiRecordedBadge from "./components/ChibiRecordedBadge";
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

function UnitVisual({unit,staticData,compact=false}:{unit:TftUnit;staticData:TftStaticData|null;compact?:boolean}){
  const entry=staticEntry(staticData?.champions,unit.characterId);
  const name=entry?.name || cleanName(unit.characterId);
  const image=staticData? tftAssetUrl(staticData.version,"champion",entry) : "";

  return <div className={"unit-card "+(compact?"compact":"")} title={name}>
    <div className={"unit-portrait cost-"+Math.max(1,Math.min(5,Number(entry?.tier||unit.rarity||1)))}>
      <span className="unit-fallback">{name.slice(0,2)}</span>
      {image&&<img src={image} alt={name} onError={(e)=>{e.currentTarget.style.display="none";}}/>}
      <div className="unit-stars">{"★".repeat(Math.max(1,Math.min(3,unit.tier||1)))}</div>
    </div>
    {!compact&&<div className="unit-caption">{name}</div>}
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

  useEffect(()=>{
    loadTftStaticData().then(setStaticData).catch(()=>{});

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
  const reviewSignals=useMemo(()=>buildRankedReviewSignals(analysisMatches),[analysisMatches]);
  const primaryReviewSignal=reviewSignals[0]||null;

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
    if(delta<=-.45) return {label:t("profile.trend.improving"),detail:t("profile.trend.vsBefore",{recent:recentAvg.toFixed(2),previous:previousAvg.toFixed(2)}),tone:"good"};
    if(delta>=.45) return {label:t("profile.trend.worsening"),detail:t("profile.trend.vsBefore",{recent:recentAvg.toFixed(2),previous:previousAvg.toFixed(2)}),tone:"warning"};
    return {label:t("profile.trend.stable"),detail:t("profile.trend.vsBefore",{recent:recentAvg.toFixed(2),previous:previousAvg.toFixed(2)}),tone:""};
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

  const visibleDna=useMemo(
    ()=>evidenceIds?.length||historyFilter!=="all" ? buildChibiDNA(visibleMatches) : dna,
    [evidenceIds,historyFilter,visibleMatches,dna]
  );

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
        displayMatches:session.matches.filter(match=>visibleIds.has(match.id)),
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
  },[historyBaseMatches,visibleMatches]);

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
    <div className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={resetSearch}>
          <span className="brand-mark brand-mark-image"><img src={SITE_IMAGES.icon} alt=""/></span>
          <span>chibi<span>.gg</span></span>
        </button>
        <nav className="product-nav" aria-label="Chibi">
          <button className={sitePage==="meta"?"active":""} onClick={openMeta}>{t("nav.meta")}</button>
          <button className={sitePage==="comps"?"active":""} onClick={openComps}>{t("nav.comps")}</button>
          <button className={sitePage==="stats"?"active":""} onClick={()=>openStats()}>{t("nav.statistics")}</button>
          <button className={"builder-nav-button "+(sitePage==="builder"?"active":"")} onClick={()=>openBuilder([])}>{t("nav.builder")}</button>
          <button className={sitePage==="leaderboard"?"active":""} onClick={openLeaderboard}>{t("nav.leaderboard")}</button>
          <button className={"companion-nav-button "+(sitePage==="overlay"?"active":"")} onClick={openOverlay}>{t("nav.companion")}</button>
        </nav>
        <GlobalSearch
          staticData={staticData}
          recentPlayers={recentPlayers}
          onOpenRecent={(player)=>{void openRecentPlayer(player);}}
          onOpenStats={openStats}
          onSearchPlayer={(value)=>{void searchFromGlobal(value);}}
          onOpenPage={openExplorePage}
        />
        <div className="topbar-actions">
          <LanguageSwitcher />
          <AccountMenu />
          <button className="ghost-button" onClick={()=>openInfoPage("about")}>{t("nav.howItWorks")}</button>
        </div>
      </header>

      <SiteArtworkBackdrop page={sitePage} profileTab={profileTab} hasProfile={Boolean(profile)}/>

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
                <AdaptiveArtwork className="home-product-reference-art" src={SITE_IMAGES.ui.profile} alt="" aria-hidden="true" decoding="async"/>
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

          <section className="home-paths-v2 home-paths-v3" aria-label={t("home.pathsAria")}>
            <button onClick={openMeta}>
              <span className="home-path-index"><i>✦</i><em>01</em></span>
              <div>
                <small>META</small>
                <h2>{t("home.path.meta.title")}</h2>
                <p>{t("home.path.meta.desc")}</p>
              </div>
              <b>→</b>
            </button>

            <button onClick={()=>document.getElementById("home-riot-id")?.focus()}>
              <span className="home-path-index"><i>◎</i><em>02</em></span>
              <div>
                <small>{t("home.path.game.label")}</small>
                <h2>{t("home.path.game.title")}</h2>
                <p>{t("home.path.game.desc")}</p>
              </div>
              <b>→</b>
            </button>

            <button onClick={()=>openBuilder([])}>
              <span className="home-path-index"><i>◇</i><em>03</em></span>
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
              <span>{t("home.builder.kicker")}</span>
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
            <AdaptiveArtwork className="player-summary-reference-art" src={SITE_IMAGES.ui.profile} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
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
                <span>{profile.player.level}</span>
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
                  <span className={"player-trend "+trendStats.tone}>{trendStats.label}</span>
                </div>
              </div>
            </div>

            <div className="player-summary-actions">
              <button className="player-coach-button" onClick={()=>changeProfileTab("coach")}>Chibi Review</button>
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
            <div className="coach-art-banner" aria-hidden="true">
              <AdaptiveArtwork src={SITE_IMAGES.ui.coach} alt="" loading="lazy" decoding="async"/>
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
            <div className="content-grid profile-history-first">
            <section className="panel history history-with-reference" id="match-history">
              <AdaptiveArtwork className="history-reference-art" src={SITE_IMAGES.ui.history} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
              <div className="panel-title profile-history-head">
                <div>
                  <span>{t("profile.history.riot")}</span>
                  <h2>{t("profile.history.title")}</h2>
                  <small>{t("profile.history.count",{setCount:analysisMatches.length,set:currentSet??"—",loaded:matches.length})}</small>
                </div>

                <div className="history-head-controls">
                  {availableSets.length>1&&<div className="history-set-tabs" aria-label={t("profile.history.setsAria")}>
                    {availableSets.map(setNumber=>(
                      <button
                        className={currentSet===setNumber?"active":""}
                        onClick={()=>changeSet(setNumber)}
                        key={setNumber}
                      >Set {setNumber}</button>
                    ))}
                  </div>}

                  <div className="queue-tabs history-queue-tabs">
                    {availableQueues.length<=1 ? (
                      availableQueues.map((queueId)=>(
                        <button className="active" disabled key={queueId}>{queueLabel(staticData,queueId)}</button>
                      ))
                    ) : <>
                      <button className={selectedQueue==null?"active":""} onClick={()=>changeQueue(null)}>{t("profile.history.all")}</button>
                      {availableQueues.map((queueId)=>(
                        <button className={selectedQueue===queueId?"active":""} onClick={()=>changeQueue(queueId)} key={queueId}>
                          {queueLabel(staticData,queueId)}
                        </button>
                      ))}
                    </>}
                  </div>

                  <div className="history-filter-tabs">
                    {([
                      ["all",t("profile.history.all")],
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
              </div>

              {evidenceIds?.length&&<div className="evidence-banner">
                <div>
                  <span>{t("profile.history.activeEvidence")}</span>
                  <strong>{evidenceLabel}</strong>
                  <small>{t("profile.history.relatedCount",{count:visibleMatches.length})}</small>
                </div>
                <button onClick={clearEvidence}>{t("profile.history.fullContext")}</button>
              </div>}

              <div className="match-list match-list-v2 match-session-list">
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
                        {session.delta!=null&&Math.abs(session.delta)>.25&&<em className={session.delta<0?"better":"worse"}>
                          {session.delta<0
                            ?t("profile.history.vsPreviousUp",{value:Math.abs(session.delta).toFixed(2)})
                            :t("profile.history.vsPreviousDown",{value:Math.abs(session.delta).toFixed(2)})}
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
                        return <button className={"match-row match-button match-row-v2 cue-"+cue.tone} key={match.id} onClick={()=>openMatch(match)}>
                          <div className="match-result-rail">
                            <TacticianVisual companion={match.companion} staticData={staticData}/>
                            <div className={"placement "+placementClass(match.placement)}>{match.placement}º</div>
                          </div>

                          <div className="match-main">
                            <div className="match-context-line">
                              <span>{queueLabel(staticData,match.queueId||0)}</span>
                              {matchRoundLabel(match)&&<span>{matchRoundLabel(match)}</span>}
                              {match.duration&&<span>{formatDuration(match.duration)}</span>}
                              <span>{formatClock(match.playedAt,locale)}</span>
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

                            <div className="match-lineup">
                              <div className="match-history-support">
                                <div className="trait-row compact-traits">
                                  {activeTraits(match).slice(0,3).map((trait)=>{
                                    const entry=staticEntry(staticData?.traits,trait.name);
                                    const image=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
                                    return <span className={"trait-chip style-"+Math.max(0,trait.style)} key={trait.name}>
                                      {image&&<img src={image} alt=""/>}
                                      {traitLabel(trait,staticData)} {trait.numUnits}
                                    </span>;
                                  })}
                                </div>

                                {match.augments.length>0&&<div className="match-history-augments" aria-label={t("profile.history.augmentsAria")}>
                                  {match.augments.slice(0,3).map((augment)=>(
                                    <AugmentIcon id={augment} staticData={staticData} key={augment}/>
                                  ))}
                                </div>}
                              </div>

                              <div className={"board-row compact-board match-history-units "+(
                                match.units.length>=11
                                  ?"units-extra"
                                  :match.units.length>=9
                                    ?"units-many"
                                    :""
                              )} aria-label={t("profile.history.unitsAria",{count:match.units.length})}>
                                {match.units.map((unit,index)=><UnitVisual unit={unit} staticData={staticData} compact key={unit.characterId+index}/>)}
                              </div>
                            </div>
                          </div>

                          <div className="match-meta match-meta-rich">
                            <div className="match-value-grid match-value-grid-core">
                              <span title={t("profile.history.boardEstimateTitle")}><b>~{boardValue(match,staticData)}G</b><small>{t("profile.history.boardEstimate")}</small></span>
                              <span><b>{match.goldLeft}G</b><small>{t("profile.history.gold")}</small></span>
                              <span><b>Nv {match.level}</b><small>{t("profile.history.level")}</small></span>
                            </div>
                            <div className={"match-fast-read "+cue.tone}>
                              <span>{cue.label}</span>
                              <strong>{cue.title}</strong>
                              <small>{t("profile.history.openAnalysis")} →</small>
                            </div>
                          </div>
                        </button>;
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {!evidenceIds?.length&&hasMore && <button className="load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? t("profile.history.loadingMore") : t("profile.history.loadMore")}</button>}
            </section>

            <aside className="profile-match-sidebar">
              <section className={"profile-insight-card "+(primaryReviewSignal?"tone-"+primaryReviewSignal.tone:"")}>
                <div className="profile-insight-head">
                  <div>
                    <span>CHIBI SNAPSHOT</span>
                    <strong>{analysisMatches.length<8
                      ? t("profile.snapshot.initial",{top4:headlineStats.top4,total:headlineStats.total})
                      : primaryReviewSignal
                        ? (primaryReviewSignal.subjectId
                          ? (staticEntry(staticData?.traits,primaryReviewSignal.subjectId)?.name||fallbackTraitName(primaryReviewSignal.subjectId))+" · "+primaryReviewSignal.title
                          : primaryReviewSignal.title)
                        : t("profile.snapshot.gathering")}</strong>
                  </div>
                  <small>{t("profile.snapshot.matches",{count:visibleDna.sampleSize})}</small>
                </div>

                <div className="placement-strip profile-insight-placements" aria-label={t("profile.snapshot.placementsAria")}>
                  {visibleDna.placements.slice(0,8).map((p,index)=>(
                    <span className={placementClass(p)} key={index} title={t("profile.snapshot.placementTitle",{index:index+1,placement:p})}>{p}</span>
                  ))}
                </div>

                <div className="profile-insight-metrics">
                  <span>
                    <small>{visibleDna.sampleSize<8?t("profile.snapshot.sample"):t("profile.snapshot.consistency")}</small>
                    <b>{visibleDna.sampleSize<8?t("profile.snapshot.games",{count:visibleDna.sampleSize}):visibleDna.consistency+"%"}</b>
                  </span>
                  <span>
                    <small>Bottom 2</small>
                    <b>{analysisMatches.filter(match=>match.placement>=7).length}</b>
                  </span>
                </div>

                {visibleDna.insights[0]&&(()=>{
                  const insight=visibleDna.insights[0];
                  const subject=insight.subject
                    ? staticEntry(staticData?.traits,insight.subject)?.name || fallbackTraitName(insight.subject)
                    : "";
                  return <div className={"profile-insight-signal "+insight.tone}>
                    <span>{insight.confidence}</span>
                    <strong>{subject||insight.title}</strong>
                    {subject&&<small>{insight.title}</small>}
                  </div>;
                })()}

                <div className="profile-insight-actions">
                  <button onClick={()=>changeProfileTab("coach")}>{t("profile.snapshot.openReview")}</button>
                  <button className="secondary" onClick={()=>changeProfileTab("overview")}>{t("profile.snapshot.viewSummary")}</button>
                </div>

                <details className="profile-insight-more">
                  <summary>{t("profile.snapshot.more")}</summary>
                  <div>
                    <span><small>{t("profile.snapshot.flexibility")}</small><b>{visibleDna.sampleSize<8?"—":visibleDna.flexibility+"%"}</b></span>
                    <span><small>{t("profile.snapshot.conversion")}</small><b>{visibleDna.sampleSize<8?"—":visibleDna.conversion+"%"}</b></span>
                    <p>{evidenceIds?.length
                      ? t("profile.snapshot.activeEvidence")
                      : t("profile.snapshot.disclaimer")}</p>
                  </div>
                </details>
              </section>
            </aside>
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
            <a href="https://github.com/HelioConde/chibi.gg" target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
        </div>
        <p className="site-footer-riot">Chibi.gg isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      </footer>

      {(matchLoading || selectedMatch || matchError || studyLookup==="unavailable") && (
        <div className="match-overlay" onClick={closeMatchReview}>
          <section className="match-modal match-modal-with-hud" onClick={(e)=>e.stopPropagation()}>
            <img className="match-modal-hud-art" src={SITE_IMAGES.hud} alt="" aria-hidden="true"/>
            <button className="match-close" onClick={closeMatchReview}>×</button>
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
                  <div className={"modal-placement "+placementClass(openedMatch.placement)}>{openedMatch.placement}º</div>
                </div>}
              </div>

              {openedMatch&&<section className="match-summary-card">
                <div className="match-summary-main">
                  <span>{t("match.finalBoard")}</span>
                  <h3>{activeTraits(openedMatch).slice(0,2).map((t)=>traitLabel(t,staticData)).filter(Boolean).join(" · ") || "Board TFT"}</h3>
                  <div className="trait-row">
                    {activeTraits(openedMatch).slice(0,4).map((trait)=><span className={"trait-chip style-"+Math.max(0,trait.style)} key={trait.name}>{traitLabel(trait,staticData)} {trait.numUnits}</span>)}
                  </div>
                  <div className="board-row modal-board">
                    {openedMatch.units.map((unit,index)=><UnitVisual unit={unit} staticData={staticData} compact key={unit.characterId+index}/>)}
                  </div>
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
    </div>
  );
}

export default App;
