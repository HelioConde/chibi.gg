import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchTftHistory,
  fetchTftMatch,
  fetchTftProfile,
  TftMatch,
  TftMatchDetail,
  TftProfile,
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
import { buildActionPlan } from "./analysis/actionPlan";
import ChibiInnovations from "./components/ChibiInnovations";
import ChibiReview from "./components/ChibiReview";
import MatchJournal from "./components/MatchJournal";
import PatchAdaptation from "./components/PatchAdaptation";
import BoardCounterfactual from "./components/BoardCounterfactual";
import LobbyAutopsy from "./components/LobbyAutopsy";
import MatchStory from "./components/MatchStory";
import ChibiShareCard from "./components/ChibiShareCard";
import PersonalVsGlobalMeta from "./components/PersonalVsGlobalMeta";
import ChibiIdentity from "./components/ChibiIdentity";
import ChibiActionCenter from "./components/ChibiActionCenter";
import StyleShift from "./components/StyleShift";
import GlobalMetaPage from "./components/GlobalMetaPage";
import CompsPage from "./components/CompsPage";
import OverlayPage from "./components/OverlayPage";
import StatisticsPage, { StatisticsCategory } from "./components/StatisticsPage";
import GlobalSearch from "./components/GlobalSearch";
import HomeMetaPreview from "./components/HomeMetaPreview";
import TeamBuilderPage from "./components/TeamBuilderPage";
import LeaderboardPage from "./components/LeaderboardPage";
import AskChibi from "./components/AskChibi";
import ChibiMemory from "./components/ChibiMemory";
import ReviewQueue from "./components/ReviewQueue";
import PlayerEvolution from "./components/PlayerEvolution";
import DDragonArt from "./components/DDragonArt";
import MatchBoardMap from "./components/MatchBoardMap";
import { SITE_IMAGES } from "./siteAssets";
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

function activeTraits(match:TftMatch){
  return match.traits
    .filter((t)=>t.numUnits>0 && (t.style>0 || t.numUnits>=2))
    .sort((a,b)=>b.style-a.style || b.numUnits-a.numUnits);
}

function formatClock(timestamp?:number){
  if(!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}

function formatDay(timestamp?:number){
  if(!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

function formatWhen(timestamp?:number){
  if(!timestamp) return "";
  const date=new Date(timestamp);
  const diff=Date.now()-date.getTime();
  const hours=Math.floor(diff/3600000);
  if(hours<1) return "agora";
  if(hours<24) return hours+"h";
  const days=Math.floor(hours/24);
  if(days<7) return days+"d";
  return date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
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

function matchReviewCue(match:TftMatch){
  const threeStars=match.units.filter(unit=>unit.tier>=3).length;

  if(match.placement===1){
    return {
      tone:"good",
      label:"Board referência",
      title:threeStars>0
        ? "Vitória com "+threeStars+" unidade(s) 3★ no board final."
        : "Vitória: use este board final como referência do que converteu.",
    };
  }

  if(match.placement<=4){
    return {
      tone:"good",
      label:"Top 4 sem fechar",
      title:match.goldLeft>=10
        ? "Top 4 com "+match.goldLeft+"g finais: investigue se havia uma janela de conversão."
        : "Boa partida sem 1º: compare o board final com quem terminou acima.",
    };
  }

  if(match.placement>=7){
    if(match.goldLeft>=10){
      return {
        tone:"bad",
        label:"Ouro não convertido",
        title:"Bottom 2 terminando com "+match.goldLeft+"g: este é o primeiro sinal para revisar.",
      };
    }
    if(match.level>=8){
      return {
        tone:"bad",
        label:"Nível sem conversão",
        title:"Bottom 2 mesmo terminando nível "+match.level+": chegar ao nível não bastou.",
      };
    }
    return {
      tone:"bad",
      label:"Revisar primeiro",
      title:"Bottom 2: compare força final, upgrades e contestação visível.",
    };
  }

  if(match.level>=8){
    return {
      tone:"neutral",
      label:"Nível alto · meio da lobby",
      title:"Você chegou ao nível "+match.level+", mas o board terminou fora do Top 4.",
    };
  }

  return {
    tone:"neutral",
    label:"Meio da lobby",
    title:"Veja onde este board parou de ganhar força antes do Top 4.",
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

function AugmentVisual({id,staticData}:{id:string;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.augments,id);
  const image=staticData?tftAssetUrl(staticData.version,"augment",entry):"";
  const name=entry?.name||cleanName(id);
  return <span className="augment-chip" title={name}>
    {image&&<img src={image} alt=""/>}
    <span>{name}</span>
  </span>;
}

type ProfileTab = "overview"|"review"|"meta"|"matches"|"share";

function parseProfileTab(value:string|null):ProfileTab{
  return value==="review"||value==="meta"||value==="overview"||value==="share"
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
  const [riotId,setRiotId]=useState("");
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
  const [copiedAnalysisLink,setCopiedAnalysisLink]=useState(false);
  const [statsTarget,setStatsTarget]=useState<{
    category:StatisticsCategory;
    query:string;
    view:"stats"|"tier";
  }>({
    category:"champions",
    query:"",
    view:"stats",
  });
  const [sitePage,setSitePage]=useState<"main"|"meta"|"comps"|"stats"|"builder"|"leaderboard"|"overlay">(
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

    if(player&&tag){
      setRiotId(player+"#"+tag);
      setPlatform(region);
      void loadPlayer(player,tag,region,false,tab,queue);
    }

    const onPopState=()=>{
      const nextParams=new URLSearchParams(window.location.search);
      setProfileTab(parseProfileTab(nextParams.get("tab")));
      const raw=Number(nextParams.get("queue"));
      setSelectedQueue(Number.isFinite(raw)&&raw>0?raw:null);
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
                    :"main"
      );
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

  const currentSet=useMemo(()=>{
    const found=matches.find((m)=>Number(m.setNumber)>0);
    return found ? Number(found.setNumber) : null;
  },[matches]);

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

  const staticCurrentSet=useMemo(()=>latestTftSetNumber(staticData),[staticData]);
  const isHistoricalSet=Boolean(currentSet&&staticCurrentSet&&currentSet<staticCurrentSet);

  const metaQueueId=useMemo(
    ()=>selectedQueue ?? (availableQueues.length===1 ? availableQueues[0] : null),
    [selectedQueue,availableQueues]
  );

  const dna=useMemo(()=>buildChibiDNA(analysisMatches),[analysisMatches]);
  const quickPlan=useMemo(()=>buildActionPlan(analysisMatches),[analysisMatches]);

  const headlineStats=useMemo(()=>{
    const total=analysisMatches.length;
    const top4=analysisMatches.filter(match=>match.placement<=4).length;
    const wins=analysisMatches.filter(match=>match.placement===1).length;
    const bottom2=analysisMatches.filter(match=>match.placement>=7).length;
    const avg=dna.avgPlacement;
    const avgLabel=avg==null
      ? "amostra insuficiente"
      : avg<=4
        ? "acima do meio da lobby"
        : avg<=4.75
          ? "próximo do meio da lobby"
          : "abaixo do meio da lobby";

    return {total,top4,wins,bottom2,avgLabel};
  },[analysisMatches,dna.avgPlacement]);

  const trendStats=useMemo(()=>{
    if(analysisMatches.length<6) return {label:"Pouca amostra",detail:"carregue ao menos 6 partidas",tone:""};
    const window=Math.min(3,Math.floor(analysisMatches.length/2));
    const recent=analysisMatches.slice(0,window);
    const previous=analysisMatches.slice(window,window*2);
    const avg=(list:TftMatch[])=>list.reduce((sum,match)=>sum+match.placement,0)/Math.max(1,list.length);
    const recentAvg=avg(recent);
    const previousAvg=avg(previous);
    const delta=recentAvg-previousAvg;
    if(delta<=-.45) return {label:"Melhorando",detail:`${recentAvg.toFixed(2)} vs ${previousAvg.toFixed(2)} antes`,tone:"good"};
    if(delta>=.45) return {label:"Piorando",detail:`${recentAvg.toFixed(2)} vs ${previousAvg.toFixed(2)} antes`,tone:"warning"};
    return {label:"Estável",detail:`${recentAvg.toFixed(2)} vs ${previousAvg.toFixed(2)} antes`,tone:""};
  },[analysisMatches]);

  const visibleMatches=useMemo(()=>{
    const evidenceFiltered=evidenceIds?.length
      ? analysisMatches.filter((match)=>new Set(evidenceIds).has(match.id))
      : analysisMatches;

    if(historyFilter==="top4") return evidenceFiltered.filter(match=>match.placement<=4);
    if(historyFilter==="bottom2") return evidenceFiltered.filter(match=>match.placement>=7);
    if(historyFilter==="review") return evidenceFiltered.filter(match=>
      match.placement>=7 || (match.placement>=5&&(match.goldLeft>=10||match.level>=8))
    );
    return evidenceFiltered;
  },[analysisMatches,evidenceIds,historyFilter]);

  const visibleDna=useMemo(
    ()=>evidenceIds?.length||historyFilter!=="all" ? buildChibiDNA(visibleMatches) : dna,
    [evidenceIds,historyFilter,visibleMatches,dna]
  );

  const historySessions=useMemo(()=>{
    const sorted=visibleMatches
      .slice()
      .sort((a,b)=>(b.playedAt||0)-(a.playedAt||0));

    const sessions:Array<{matches:TftMatch[];start:number;end:number}> = [];

    for(const match of sorted){
      const playedAt=Number(match.playedAt)||0;
      const current=sessions[sessions.length-1];

      if(!current){
        sessions.push({matches:[match],start:playedAt,end:playedAt});
        continue;
      }

      const previous=current.matches[current.matches.length-1];
      const gap=Math.abs((previous.playedAt||0)-playedAt);

      if(gap>2.5*60*60*1000){
        sessions.push({matches:[match],start:playedAt,end:playedAt});
        continue;
      }

      current.matches.push(match);
      current.start=Math.min(current.start||playedAt,playedAt);
      current.end=Math.max(current.end||playedAt,playedAt);
    }

    return sessions.map((session,index)=>{
      const games=session.matches.length;
      const average=session.matches.reduce((sum,match)=>sum+match.placement,0)/Math.max(1,games);
      const top4=session.matches.filter(match=>match.placement<=4).length;
      const bottom2=session.matches.filter(match=>match.placement>=7).length;
      const wins=session.matches.filter(match=>match.placement===1).length;

      return {
        ...session,
        index,
        games,
        average,
        top4Rate:Math.round(top4/Math.max(1,games)*100),
        bottom2,
        wins,
      };
    });
  },[visibleMatches]);

  const latestSession=useMemo(()=>{
    if(!analysisMatches.length)return [];
    const sorted=analysisMatches.slice().sort((a,b)=>(b.playedAt||0)-(a.playedAt||0));
    const session=[sorted[0]];
    for(let index=1;index<sorted.length;index++){
      const previous=session[session.length-1];
      const gap=Math.abs((previous.playedAt||0)-(sorted[index].playedAt||0));
      if(gap>2.5*60*60*1000)break;
      session.push(sorted[index]);
    }
    return session;
  },[analysisMatches]);

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

  const latestPlayedAt=useMemo(
    ()=>Math.max(0,...analysisMatches.map((m)=>Number(m.playedAt)||0)),
    [analysisMatches]
  );

  const freshnessDays=latestPlayedAt
    ? Math.floor((Date.now()-latestPlayedAt)/86400000)
    : null;

  function updateProfileUrl(tab:ProfileTab=profileTab,queue:number|null=selectedQueue){
    if(!profile) return;
    const url=new URL(window.location.href);
    url.searchParams.set("player",profile.player.gameName);
    url.searchParams.set("tag",profile.player.tagLine);
    url.searchParams.set("region",profile.player.platform);
    url.searchParams.set("tab",tab);
    if(queue!=null) url.searchParams.set("queue",String(queue));
    else url.searchParams.delete("queue");
    window.history.replaceState({},"",url.toString());
  }

  function changeProfileTab(tab:ProfileTab){
    setProfileTab(tab);
    updateProfileUrl(tab,selectedQueue);
  }

  async function copyCurrentAnalysisLink(){
    updateProfileUrl(profileTab,selectedQueue);
    try{
      await navigator.clipboard.writeText(window.location.href);
      setCopiedAnalysisLink(true);
      window.setTimeout(()=>setCopiedAnalysisLink(false),1600);
    }catch{
      setCopiedAnalysisLink(false);
    }
  }

  function changeQueue(queue:number|null){
    setSelectedQueue(queue);
    clearEvidence();
    updateProfileUrl(profileTab,queue);
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

  async function loadPlayer(
    gameName:string,
    tagLine:string,
    region:string,
    updateUrl=true,
    initialTab:ProfileTab="matches",
    initialQueue:number|null=null,
  ){
    setLoading(true);
    setError("");
    setProfile(null);
    setMatches([]);
    setHasMore(true);
    setSelectedMatch(null);
    setOpenedMatch(null);
    setSelectedQueue(initialQueue);
    setProfileTab(initialTab);
    clearEvidence();

    try{
      const data=await fetchTftProfile(gameName,tagLine,region);
      setProfile(data);
      setMatches(data.matches || []);
      setHasMore((data.matches?.length || 0) >= 12);

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
        window.history.replaceState({},"",url.toString());
      }
    }catch(err){
      setError(err instanceof Error ? err.message : "Não foi possível consultar este jogador agora.");
    }finally{
      setLoading(false);
    }
  }

  async function searchPlayer(){
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

  function forgetRecentPlayer(player:RecentPlayer){
    setRecentPlayers(removeRecentPlayer(player));
  }

  async function loadMore(){
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
      setError(err instanceof Error ? err.message : "Não foi possível carregar mais partidas.");
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

    try{
      const detail=await fetchTftMatch(match.id);
      setSelectedMatch(detail);
    }catch(err){
      setMatchError(err instanceof Error ? err.message : "Não foi possível abrir esta partida.");
    }finally{
      setMatchLoading(false);
    }
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
  }

  function openComps(){
    setSitePage("comps");
    if(window.location.hash!=="#comps"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#comps");
    }
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
  }

  function openLeaderboard(){
    setSitePage("leaderboard");
    if(window.location.hash!=="#leaderboard"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#leaderboard");
    }
  }

  function openOverlay(){
    setSitePage("overlay");
    if(window.location.hash!=="#overlay"){
      window.history.pushState({},"",window.location.pathname+window.location.search+"#overlay");
    }
  }

  function closeExplorePage(){
    setSitePage("main");
    if(window.location.hash){
      window.history.replaceState({},"",window.location.pathname+window.location.search);
    }
  }

  function showCompEvidence(ids:string[],label:string){
    closeExplorePage();
    requestAnimationFrame(()=>showEvidence(ids,label));
  }

  function resetSearch(){
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
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={resetSearch}>
          <span className="brand-mark brand-mark-image"><img src={SITE_IMAGES.icon} alt=""/></span>
          <span>chibi<span>.gg</span></span>
        </button>
        <nav>
          <button className={sitePage==="meta"?"active":""} onClick={openMeta}>Meta</button>
          <button className={sitePage==="comps"?"active":""} onClick={openComps}>Comps</button>
          <button className={sitePage==="stats"?"active":""} onClick={()=>openStats()}>Statistics</button>
          <button className={"builder-nav-button "+(sitePage==="builder"?"active":"")} onClick={()=>openBuilder([])}>Builder</button>
          <button className={sitePage==="leaderboard"?"active":""} onClick={openLeaderboard}>Leaderboard</button>
          <button className={sitePage==="overlay"?"active":""} onClick={openOverlay}>Overlay</button>
        </nav>
        <GlobalSearch
          staticData={staticData}
          recentPlayers={recentPlayers}
          onOpenRecent={(player)=>{void openRecentPlayer(player);}}
          onOpenStats={openStats}
          onSearchPlayer={(value)=>{void searchFromGlobal(value);}}
          onOpenPage={openExplorePage}
        />
        <button className="ghost-button">Entrar</button>
      </header>

      {sitePage==="meta" ? (
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
          onBack={closeExplorePage}
        />
      ) : !profile ? (
        <main className="landing">
          <section className="hero hero-with-ddragon hero-with-uploaded-art">
            <img className="uploaded-hero-art" src={SITE_IMAGES.art} alt="" aria-hidden="true"/>
            <img className="uploaded-icons-art" src={SITE_IMAGES.icons} alt="" aria-hidden="true"/>
            <DDragonArt staticData={staticData} variant="hero" label="Riot Data Dragon"/>
            <div className="eyebrow">TFT FIRST. DATA THAT HELPS YOU CLIMB.</div>
            <h1>Entenda suas partidas.<br /><span>Suba com intenção.</span></h1>
            <p>Busque qualquer Riot ID e veja rank, histórico, comps, padrões e insights pensados especificamente para Teamfight Tactics.</p>

            <form className="search-box" onSubmit={handleSubmit}>
              <select aria-label="Região" value={platform} onChange={(e)=>setPlatform(e.target.value)}>
                <option value="br1">BR</option><option value="na1">NA</option><option value="euw1">EUW</option>
                <option value="eun1">EUNE</option><option value="kr">KR</option><option value="jp1">JP</option>
                <option value="la1">LAN</option><option value="la2">LAS</option><option value="oc1">OCE</option>
              </select>
              <input value={riotId} onChange={(e)=>setRiotId(e.target.value)} placeholder="Nome#TAG" aria-label="Riot ID"/>
              <button type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar jogador"}</button>
            </form>

            {error && <div className="lookup-error">{error}</div>}

            {recentPlayers.length>0&&<section className="recent-players">
              <div className="recent-players-head">
                <div>
                  <span>HISTÓRICO</span>
                  <strong>Jogadores pesquisados recentemente</strong>
                </div>
                <small>{recentPlayers.length} salvo{recentPlayers.length===1?"":"s"} neste navegador</small>
              </div>

              <div className="recent-player-list">
                {recentPlayers
                  .filter(player=>{
                    const query=riotId.trim().toLowerCase();
                    if(!query) return true;
                    return (player.gameName+"#"+player.tagLine).toLowerCase().includes(query);
                  })
                  .slice(0,5)
                  .map(player=>(
                    <article className="recent-player-card" key={player.platform+":"+player.gameName+"#"+player.tagLine}>
                      <button className="recent-player-open" onClick={()=>void openRecentPlayer(player)}>
                        <span className="recent-player-avatar">
                          {staticData&&player.profileIconId
                            ?<img src={profileIconUrl(staticData.version,player.profileIconId)} alt="" onError={(e)=>{e.currentTarget.style.display="none";}}/>
                            :player.gameName.slice(0,1).toUpperCase()}
                        </span>
                        <span className="recent-player-copy">
                          <strong>{player.gameName}<small>#{player.tagLine}</small></strong>
                          <em>{player.platform.toUpperCase()} · {player.rankLabel}{player.leaguePoints!=null?" · "+player.leaguePoints+" LP":""}</em>
                        </span>
                        <span className="recent-player-stats">
                          <b>{player.averagePlacement??"—"}</b>
                          <small>média</small>
                        </span>
                      </button>
                      <button className="recent-player-remove" onClick={()=>forgetRecentPlayer(player)} aria-label={"Remover "+player.gameName+" do histórico"}>×</button>
                    </article>
                  ))}
              </div>
            </section>}

            <div className="quick-stats">
              <div><strong>Sem cadastro</strong><span>perfil TFT instantâneo</span></div>
              <div><strong>Dados Riot</strong><span>rank + partidas oficiais</span></div>
              <div><strong>Insights</strong><span>o que melhorar, não só números</span></div>
            </div>
          </section>

          <HomeMetaPreview
            staticData={staticData}
            onOpenMeta={openMeta}
            onOpenComps={openComps}
            onOpenStats={(category,query="")=>openStats(category,query)}
          />

          <section className="feature-grid">
            <article><span>01</span><h3>Seu jogo, não só o meta</h3><p>Descubra quais estilos, traits e ritmos realmente funcionam para você.</p></article>
            <article><span>02</span><h3>Partidas explicadas</h3><p>Veja colocação, board, augments, unidades e economia em contexto.</p></article>
            <article><span>03</span><h3>TFT de verdade</h3><p>Um tracker pensado primeiro para TFT, não como uma aba secundária de LoL.</p></article>
          </section>
        </main>
      ) : (
        <main className="profile-page">
          <button className="back-search" onClick={resetSearch}>← Nova busca</button>

          <section className="player-summary-shell player-summary-visual">
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
                  Histórico do Set {currentSet} · Set atual {staticCurrentSet}
                </div>}
                <h1>{profile.player.gameName}<span className="player-tag">#{profile.player.tagLine}</span></h1>
                <div className="player-rank-line">
                  <strong>{rank ? rank.tier+" "+rank.rank : "Sem rank atual"}</strong>
                  {rank&&<span>{rank.leaguePoints} LP · {rank.wins}V / {rank.losses}D</span>}
                  <span className={"player-trend "+trendStats.tone}>{trendStats.label}</span>
                </div>
              </div>
            </div>

            <div className="player-summary-kpis">
              <article>
                <span>Média</span>
                <strong>{dna.avgPlacement??"—"}</strong>
                <small>{headlineStats.avgLabel}</small>
              </article>
              <article>
                <span>Top 4</span>
                <strong>{dna.top4Rate}%</strong>
                <small>{headlineStats.top4}/{headlineStats.total}</small>
              </article>
              <article>
                <span>Última</span>
                <strong>{latestPlayedAt?formatWhen(latestPlayedAt):"—"}</strong>
                <small>{freshnessDays!=null&&freshnessDays>14?"amostra antiga":"partida mais recente"}</small>
              </article>
            </div>

            <div className="player-summary-actions">
              <button className="refresh-button" onClick={searchPlayer} disabled={loading}>{loading?"Atualizando...":"Atualizar"}</button>
            </div>
          </section>

          <section className="profile-context-strip">
            <div className="queue-tabs">
              {availableQueues.length<=1 ? (
                availableQueues.map((queueId)=>(
                  <button className="active" disabled key={queueId}>{queueLabel(staticData,queueId)}</button>
                ))
              ) : <>
                <button className={selectedQueue==null?"active":""} onClick={()=>changeQueue(null)}>Todas</button>
                {availableQueues.map((queueId)=>(
                  <button className={selectedQueue===queueId?"active":""} onClick={()=>changeQueue(queueId)} key={queueId}>
                    {queueLabel(staticData,queueId)}
                  </button>
                ))}
              </>}
            </div>
            <span>{analysisMatches.length} partidas no contexto</span>
          </section>

          {error && <div className="profile-error">{error}</div>}

          <nav className="profile-tabs simplified-tabs" aria-label="Seções do perfil">
            <div className="profile-tab-list">
              <button className={profileTab==="matches"?"active":""} onClick={()=>changeProfileTab("matches")}>Partidas</button>
              <button className={profileTab==="overview"?"active":""} onClick={()=>changeProfileTab("overview")}>Agora</button>
              <button className={profileTab==="review"?"active":""} onClick={()=>changeProfileTab("review")}>Por quê?</button>
              <button className={profileTab==="meta"?"active":""} onClick={()=>changeProfileTab("meta")}>Comparar</button>
            </div>
            <div className="profile-tab-actions">
              <button className="share-analysis-button" onClick={()=>changeProfileTab("share")}>Compartilhar</button>
              <button className="copy-analysis-link" onClick={copyCurrentAnalysisLink}>
                {copiedAnalysisLink?"Link copiado ✓":"Copiar link"}
              </button>
            </div>
          </nav>

          {profileTab==="overview"&&<>
            <ChibiActionCenter
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              onEvidence={showEvidence}
              onReviewQueue={openReviewQueue}
            />

            <details className="overview-deep-dive">
              <summary>
                <span><b>Explorar padrões e sinais secundários</b><small>Arquétipo, sessão recente, linhas pessoais e outros sinais</small></span>
                <em>Ver detalhes</em>
              </summary>
              <div className="overview-deep-dive-content">
                <ChibiIdentity matches={analysisMatches}/>
                <ChibiInnovations
                  matches={analysisMatches}
                  staticData={staticData}
                  onEvidence={showEvidence}
                />
              </div>
            </details>
          </>}

          {profileTab==="review"&&<>
            <ChibiReview
              matches={analysisMatches}
              staticData={staticData}
              journalVersion={journalVersion}
              onEvidence={showEvidence}
            />

            <ChibiMemory
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
            />

            <details className="secondary-analysis">
              <summary><span><b>Ver mudança de estilo recente</b><small>Compare blocos recentes sem tratar variação como evolução de habilidade</small></span><em>Style Shift</em></summary>
              <StyleShift matches={analysisMatches}/>
            </details>
          </>}

          {profileTab==="meta"&&<>
            <PersonalVsGlobalMeta
              matches={analysisMatches}
              setNumber={currentSet}
              queueId={metaQueueId}
              staticData={staticData}
              onEvidence={showEvidence}
            />

            <details className="secondary-analysis">
              <summary><span><b>Ver adaptação ao patch</b><small>Leitura histórica complementar da amostra atual</small></span><em>Patch</em></summary>
              <PatchAdaptation
                matches={analysisMatches}
                onEvidence={showEvidence}
              />
            </details>
          </>}

          {profileTab==="share"&&<ChibiShareCard
            profile={profile}
            dna={dna}
            matches={analysisMatches}
            staticData={staticData}
            shareUrl={window.location.href}
          />}

          {profileTab==="matches"&&<>
            <section className="matches-priority-bar">
              <div className="matches-priority-problem">
                <span>O QUE ESTÁ TE PUNINDO</span>
                <strong>{quickPlan.problem.title}</strong>
                <small>{quickPlan.problem.evidence} · confiança {quickPlan.problem.confidence}</small>
              </div>
              <div className="matches-priority-action">
                <span>FAÇA AGORA</span>
                <strong>{quickPlan.action.title}</strong>
                <small>{quickPlan.action.steps[0]}</small>
              </div>
              <div className="matches-priority-cta">
                {quickPlan.problem.matchIds.length>0&&<button onClick={()=>showEvidence(
                  quickPlan.problem.matchIds,
                  "Prioridade atual · "+quickPlan.problem.title,
                )}>Ver evidências</button>}
                <button className="secondary" onClick={()=>changeProfileTab("overview")}>Abrir plano completo</button>
              </div>
            </section>

            <div className="content-grid">
            <section className="panel history" id="match-history">
              <div className="panel-title">
                <div><span>PARTIDAS RIOT</span><h2>Histórico recente</h2></div>
                <small>{visibleMatches.length} exibidas</small>
              </div>

              <div className="history-session-strip">
                <div>
                  <span>SESSÃO MAIS RECENTE</span>
                  <strong>{latestSession.length} partida{latestSession.length===1?"":"s"}</strong>
                  <small>{latestSession.length
                    ? "média "+(latestSession.reduce((sum,match)=>sum+match.placement,0)/latestSession.length).toFixed(2)
                    : "sem amostra"}
                  </small>
                </div>
                <div className="history-filter-tabs">
                  {([
                    ["all","Todas"],
                    ["review","Revisar"],
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

              {evidenceIds?.length&&<div className="evidence-banner">
                <div>
                  <span>EVIDÊNCIA ATIVA</span>
                  <strong>{evidenceLabel}</strong>
                  <small>{visibleMatches.length} partida{visibleMatches.length===1?"":"s"} relacionada{visibleMatches.length===1?"":"s"}</small>
                </div>
                <button onClick={clearEvidence}>Mostrar contexto completo</button>
              </div>}

              <div className="match-list match-list-v2 match-session-list">
                {!visibleMatches.length&&<div className="history-empty-filter">
                  Nenhuma partida encontrada neste filtro.
                </div>}

                {historySessions.map((session)=>(
                  <section className="history-session-group" key={(session.end||session.index)+":"+session.index}>
                    <header className="history-session-head">
                      <div>
                        <span>SESSÃO {historySessions.length>1?historySessions.length-session.index:"ATUAL"}</span>
                        <strong>{formatDay(session.end)} · {formatClock(session.start)}–{formatClock(session.end)}</strong>
                        <small>{session.games} jogo{session.games===1?"":"s"}</small>
                      </div>

                      <div className="history-session-stats">
                        <span><small>MÉDIA</small><b>{session.average.toFixed(2)}</b></span>
                        <span><small>TOP 4</small><b>{session.top4Rate}%</b></span>
                        <span><small>1º</small><b>{session.wins}</b></span>
                        <span className={session.bottom2>0?"warning":""}><small>BOTTOM 2</small><b>{session.bottom2}</b></span>
                      </div>
                    </header>

                    <div className="history-session-games">
                      {session.matches.map((match)=>{
                        const cue=matchReviewCue(match);
                        return <button className={"match-row match-button match-row-v2 cue-"+cue.tone} key={match.id} onClick={()=>openMatch(match)}>
                          <div className={"placement "+placementClass(match.placement)}>{match.placement}º</div>

                          <div className="match-main">
                            <div className="match-context-line">
                              <span>{queueLabel(staticData,match.queueId||0)}</span>
                              {matchRoundLabel(match)&&<span>{matchRoundLabel(match)}</span>}
                              {match.duration&&<span>{formatDuration(match.duration)}</span>}
                              <span>{formatClock(match.playedAt)}</span>
                            </div>

                            <div className="match-row-title">
                              <div>
                                <strong>{activeTraits(match).slice(0,2).map((t)=>traitLabel(t,staticData)).filter(Boolean).join(" · ") || "Board TFT"}</strong>
                                <span className={"match-review-label "+cue.tone}>{cue.label}</span>
                              </div>
                            </div>

                            <div className={"match-fast-read "+cue.tone}>
                              <span>LEITURA RÁPIDA</span>
                              <b>{cue.title}</b>
                            </div>

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

                            <div className="board-row compact-board">
                              {match.units.slice(0,8).map((unit,index)=><UnitVisual unit={unit} staticData={staticData} compact key={unit.characterId+index}/>)}
                            </div>
                          </div>

                          <div className="match-meta match-meta-rich">
                            <div className="match-value-grid">
                              <span><b>{boardValue(match,staticData)}G</b><small>board</small></span>
                              <span><b>{match.goldLeft}G</b><small>ouro</small></span>
                              <span><b>{match.level}</b><small>nível</small></span>
                              <span><b>{match.playersEliminated||0}</b><small>elim.</small></span>
                            </div>
                            <strong>{match.damageToPlayers} dano</strong>
                            <small>abrir análise →</small>
                          </div>
                        </button>;
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {!evidenceIds?.length&&hasMore && <button className="load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Carregando..." : "Carregar mais partidas"}</button>}
            </section>

            <aside className="panel insights dna-panel dna-panel-v2">
              <div className="panel-title">
                <div>
                  <span>PADRÃO RECENTE</span>
                  <h2>{evidenceIds?.length?"O que esta evidência mostra":"Resumo das suas partidas"}</h2>
                </div>
                <small>{visibleDna.sampleSize} partidas</small>
              </div>

              <div className="placement-strip" aria-label="Colocações recentes">
                {visibleDna.placements.slice(0,8).map((p,index)=>(
                  <span className={placementClass(p)} key={index} title={(index+1)+"ª partida mais recente: "+p+"º"}>{p}</span>
                ))}
              </div>

              <div className="dna-grid dna-grid-primary">
                <article>
                  <span>Consistência</span>
                  <strong>{visibleDna.consistency}%</strong>
                  <small>variação das colocações</small>
                </article>
                <article>
                  <span>Estabilidade</span>
                  <strong>{visibleDna.stability}%</strong>
                  <small>evitou Bottom 2</small>
                </article>
              </div>

              {visibleDna.insights[0]&&(()=>{
                const insight=visibleDna.insights[0];
                const subject=insight.subject
                  ? staticEntry(staticData?.traits,insight.subject)?.name || fallbackTraitName(insight.subject)
                  : "";
                return <article className={"insight dna-primary-insight "+insight.tone}>
                  <div className="insight-head"><b>{insight.title}</b><span>{insight.confidence}</span></div>
                  {subject&&<strong className="insight-subject">{subject}</strong>}
                  <p>{insight.body}</p>
                </article>;
              })()}

              <details className="dna-more">
                <summary><span><b>Ver DNA completo</b><small>flexibilidade, conversão e outros sinais</small></span><em>Detalhes</em></summary>
                <div className="dna-more-body">
                  <div className="dna-grid">
                    <article><span>Flexibilidade</span><strong>{visibleDna.flexibility}%</strong><small>diversidade de linhas</small></article>
                    <article><span>Conversão</span><strong>{visibleDna.conversion}%</strong><small>Top 4 que viraram 1º</small></article>
                  </div>

                  <div className="dna-insights">
                    {visibleDna.insights.slice(1).map((insight)=>{
                      const subject=insight.subject
                        ? staticEntry(staticData?.traits,insight.subject)?.name || fallbackTraitName(insight.subject)
                        : "";
                      return <article className={"insight "+insight.tone} key={insight.id}>
                        <div className="insight-head"><b>{insight.title}</b><span>{insight.confidence}</span></div>
                        {subject&&<strong className="insight-subject">{subject}</strong>}
                        <p>{insight.body}</p>
                        <small>{insight.evidence}</small>
                      </article>;
                    })}
                  </div>

                  <p className="dna-disclaimer">{evidenceIds?.length
                    ? "DNA recalculado somente com as partidas da evidência ativa. Não é MMR, elo alternativo nem avaliação oficial da Riot."
                    : "Indicadores descritivos da amostra carregada. Não são MMR, elo alternativo nem avaliação oficial da Riot."}</p>
                </div>
              </details>
            </aside>
          </div>

          {!evidenceIds?.length&&<PlayerEvolution
            playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
            matches={analysisMatches}
            staticData={staticData}
            onEvidence={showEvidence}
          />}

          {!evidenceIds?.length&&<ReviewQueue
            playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
            matches={analysisMatches}
            onOpenMatch={openGuidedReview}
          />}
          </>}
          <AskChibi
            playerName={profile.player.gameName}
            matches={analysisMatches}
            onEvidence={showEvidence}
          />
        </main>
      )}

      {(matchLoading || selectedMatch || matchError) && (
        <div className="match-overlay" onClick={closeMatchReview}>
          <section className="match-modal match-modal-with-hud" onClick={(e)=>e.stopPropagation()}>
            <img className="match-modal-hud-art" src={SITE_IMAGES.hud} alt="" aria-hidden="true"/>
            <button className="match-close" onClick={closeMatchReview}>×</button>
            {matchLoading && <div className="match-state">Carregando detalhes da partida...</div>}
            {matchError && <div className="match-state error">{matchError}</div>}

            {selectedMatch && <>
              <div className="match-modal-head">
                <div>
                  <span>REVIEW DA PARTIDA</span>
                  <h2>{openedMatch ? matchReviewCue(openedMatch).title : displaySetName(selectedMatch.match.setName,selectedMatch.match.setNumber)}</h2>
                  <p>{displaySetName(selectedMatch.match.setName,selectedMatch.match.setNumber)} · {queueLabel(staticData,selectedMatch.match.queueId)} · {formatWhen(selectedMatch.match.playedAt)}</p>
                </div>
                {openedMatch&&<div className="match-modal-head-actions">
                  <div className="match-modal-nav" title="Use ← e → para navegar entre partidas">
                    <button
                      disabled={!openedMatchNavigation.newer||matchLoading}
                      onClick={()=>openedMatchNavigation.newer&&void openMatch(openedMatchNavigation.newer)}
                    >← Mais recente</button>
                    <span>{openedMatchNavigation.index>=0?openedMatchNavigation.index+1:"—"} / {analysisMatches.length}</span>
                    <button
                      disabled={!openedMatchNavigation.older||matchLoading}
                      onClick={()=>openedMatchNavigation.older&&void openMatch(openedMatchNavigation.older)}
                    >Mais antiga →</button>
                  </div>
                  <div className={"modal-placement "+placementClass(openedMatch.placement)}>{openedMatch.placement}º</div>
                </div>}
              </div>

              {openedMatch&&<section className="match-summary-card">
                <div className="match-summary-main">
                  <span>SEU BOARD FINAL</span>
                  <h3>{activeTraits(openedMatch).slice(0,2).map((t)=>traitLabel(t,staticData)).filter(Boolean).join(" · ") || "Board TFT"}</h3>
                  <div className="trait-row">
                    {activeTraits(openedMatch).slice(0,4).map((trait)=><span className={"trait-chip style-"+Math.max(0,trait.style)} key={trait.name}>{traitLabel(trait,staticData)} {trait.numUnits}</span>)}
                  </div>
                  <div className="board-row modal-board">
                    {openedMatch.units.slice(0,9).map((unit,index)=><UnitVisual unit={unit} staticData={staticData} compact key={unit.characterId+index}/>)}
                  </div>
                </div>
                <div className="match-summary-stats">
                  <span><small>NÍVEL</small><b>{openedMatch.level}</b></span>
                  <span><small>DANO</small><b>{openedMatch.damageToPlayers}</b></span>
                  <span><small>OURO</small><b>{openedMatch.goldLeft}g</b></span>
                  <span><small>DURAÇÃO</small><b>{formatDuration(selectedMatch.match.duration)}</b></span>
                </div>
              </section>}

              {openedMatch&&<MatchStory
                target={openedMatch}
                detail={selectedMatch}
              />}

              {openedMatch&&<MatchBoardMap
                match={openedMatch}
                staticData={staticData}
              />}

              {openedMatch&&<LobbyAutopsy
                target={openedMatch}
                detail={selectedMatch}
                staticData={staticData}
              />}

              {openedMatch&&<details className="match-detail-layer counter-layer">
                <summary><span><b>Comparar com seu próprio histórico</b><small>Boards parecidos seus que terminaram melhor ou pior</small></span><em>Counterfactual</em></summary>
                <BoardCounterfactual
                  target={openedMatch}
                  history={analysisMatches}
                  staticData={staticData}
                  onEvidence={showCounterEvidence}
                />
              </details>}

              {openedMatch&&<details className="match-detail-layer">
                <summary><span><b>Adicionar contexto pessoal</b><small>O que a API não sabe sobre esta partida</small></span><em>Journal</em></summary>
                <MatchJournal
                  matchId={openedMatch.id}
                  placement={openedMatch.placement}
                  onSaved={()=>setJournalVersion((value)=>value+1)}
                />
              </details>}

              <details className="match-detail-layer lobby-layer">
                <summary><span><b>Ver lobby completo</b><small>Todos os 8 boards, itens, augments e resultados</small></span><em>{selectedMatch.match.participants.length} jogadores</em></summary>
                <div className="lobby-list">
                  {selectedMatch.match.participants.slice().sort((a,b)=>a.placement-b.placement).map((participant,index)=>(
                    <article className={"lobby-player "+(openedMatch?.placement===participant.placement?"current-player":"")} key={index}>
                      <div className={"placement "+placementClass(participant.placement)}>{participant.placement}º</div>
                      <div className="lobby-board">
                        <div className="lobby-title">
                          <strong>Nível {participant.level}</strong>
                          {openedMatch?.placement===participant.placement&&<span>VOCÊ</span>}
                        </div>
                        <div className="trait-row lobby-traits">
                          {participant.traits
                            .filter((t)=>t.numUnits>0&&(t.style>0||t.numUnits>=2))
                            .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
                            .slice(0,4)
                            .map((trait)=><span className="trait-chip" key={trait.name}>{traitLabel(trait,staticData)} {trait.numUnits}</span>)}
                        </div>
                        <div className="board-row detailed">
                          {participant.units.slice(0,9).map((unit,unitIndex)=><UnitVisual unit={unit} staticData={staticData} key={unit.characterId+unitIndex}/>)}
                        </div>
                        <div className="augment-row">
                          {participant.augments.slice(0,3).map((augment)=><AugmentVisual id={augment} staticData={staticData} key={augment}/>)}
                        </div>
                      </div>
                      <div className="lobby-meta">
                        <strong>{participant.damageToPlayers} dano</strong>
                        <span>{participant.goldLeft}g</span>
                      </div>
                    </article>
                  ))}
                </div>
              </details>

              {openedMatch&&guidedReviewIds.length>0&&<section className="guided-review-footer">
                <div>
                  <span>REVIEW QUEUE</span>
                  <strong>{guidedReviewIndex+1} de {guidedReviewIds.length}</strong>
                  <small>{guidedReviewIndex+1<guidedReviewIds.length
                    ?"Depois desta, o Chibi abre automaticamente a próxima."
                    :"Última partida da revisão guiada."}</small>
                </div>
                <div className="guided-review-actions">
                  <button className="secondary" onClick={closeMatchReview}>Sair da fila</button>
                  <button onClick={completeGuidedReview}>
                    {guidedReviewIndex+1<guidedReviewIds.length
                      ?"Marcar revisada e abrir próxima →"
                      :"Marcar revisada e concluir ✓"}
                  </button>
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
