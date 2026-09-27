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
} from "./tftStatic";
import { buildChibiDNA } from "./analysis/chibiInsights";
import ChibiInnovations from "./components/ChibiInnovations";
import ChibiReview from "./components/ChibiReview";
import MatchJournal from "./components/MatchJournal";
import PatchAdaptation from "./components/PatchAdaptation";
import BoardCounterfactual from "./components/BoardCounterfactual";
import NextSessionGoal from "./components/NextSessionGoal";
import ChibiShareCard from "./components/ChibiShareCard";
import PersonalVsGlobalMeta from "./components/PersonalVsGlobalMeta";
import ChibiIdentity from "./components/ChibiIdentity";
import StyleShift from "./components/StyleShift";

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
  return value==="review"||value==="meta"||value==="matches"||value==="share"
    ? value
    : "overview";
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
  const [evidenceIds,setEvidenceIds]=useState<string[]|null>(null);
  const [evidenceLabel,setEvidenceLabel]=useState("");
  const [journalVersion,setJournalVersion]=useState(0);
  const [profileTab,setProfileTab]=useState<ProfileTab>("overview");
  const [copiedAnalysisLink,setCopiedAnalysisLink]=useState(false);

  useEffect(()=>{
    loadTftStaticData().then(setStaticData).catch(()=>{});

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

    window.addEventListener("popstate",onPopState);
    return ()=>window.removeEventListener("popstate",onPopState);
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

  const metaQueueId=useMemo(
    ()=>selectedQueue ?? (availableQueues.length===1 ? availableQueues[0] : null),
    [selectedQueue,availableQueues]
  );

  const dna=useMemo(()=>buildChibiDNA(analysisMatches),[analysisMatches]);

  const visibleMatches=useMemo(()=>{
    if(!evidenceIds?.length) return analysisMatches;
    const allowed=new Set(evidenceIds);
    return analysisMatches.filter((match)=>allowed.has(match.id));
  },[analysisMatches,evidenceIds]);

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

  function showCounterEvidence(ids:string[],label:string){
    setSelectedMatch(null);
    setOpenedMatch(null);
    setMatchError("");
    showEvidence(ids,label);
  }

  async function loadPlayer(
    gameName:string,
    tagLine:string,
    region:string,
    updateUrl=true,
    initialTab:ProfileTab="overview",
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

  function resetSearch(){
    setProfile(null);
    setMatches([]);
    setError("");
    setSelectedMatch(null);
    setOpenedMatch(null);
    setMatchError("");
    setProfileTab("overview");
    clearEvidence();

    const url=new URL(window.location.href);
    url.search="";
    window.history.replaceState({},"",url.toString());
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={resetSearch}>
          <span className="brand-mark">c</span>
          <span>chibi<span>.gg</span></span>
        </button>
        <nav>
          <a href="#meta">Meta</a>
          <a href="#comps">Comps</a>
          <a href="#leaderboard">Leaderboard</a>
        </nav>
        <button className="ghost-button">Entrar</button>
      </header>

      {!profile ? (
        <main className="landing">
          <section className="hero">
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

            <div className="quick-stats">
              <div><strong>Sem cadastro</strong><span>perfil TFT instantâneo</span></div>
              <div><strong>Dados Riot</strong><span>rank + partidas oficiais</span></div>
              <div><strong>Insights</strong><span>o que melhorar, não só números</span></div>
            </div>
          </section>

          <section className="feature-grid">
            <article><span>01</span><h3>Seu jogo, não só o meta</h3><p>Descubra quais estilos, traits e ritmos realmente funcionam para você.</p></article>
            <article><span>02</span><h3>Partidas explicadas</h3><p>Veja colocação, board, augments, unidades e economia em contexto.</p></article>
            <article><span>03</span><h3>TFT de verdade</h3><p>Um tracker pensado primeiro para TFT, não como uma aba secundária de LoL.</p></article>
          </section>
        </main>
      ) : (
        <main className="profile-page">
          <button className="back-search" onClick={resetSearch}>← Nova busca</button>

          <section className="player-header">
            <div className="avatar">{profile.player.gameName.slice(0,1).toUpperCase()}</div>
            <div>
              <div className="eyebrow">PERFIL TFT · {profile.player.platform}</div>
              <h1>{profile.player.gameName}<span className="player-tag">#{profile.player.tagLine}</span></h1>
              <div className="rank-line">
                {rank ? rank.tier+" "+rank.rank+" · "+rank.leaguePoints+" LP" : "Sem rank atual"}
                <span>{matches.length} partidas carregadas</span>
              </div>
            </div>
            <button className="refresh-button" onClick={searchPlayer} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</button>
          </section>

          <section className="context-bar">
            <div className="context-copy">
              <span>CONTEXTO ANALISADO</span>
              <strong>{currentSet ? "Set "+currentSet : "Set atual"}</strong>
              <small>{analysisMatches.length} partidas nesta amostra</small>
            </div>

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

            <div className={"freshness "+(freshnessDays!=null&&freshnessDays>14?"stale":"")}>
              <span>ÚLTIMA PARTIDA</span>
              <strong>{latestPlayedAt ? formatWhen(latestPlayedAt) : "—"}</strong>
              {freshnessDays!=null&&freshnessDays>14&&<small>Amostra antiga</small>}
            </div>
          </section>

          <section className="stat-grid">
            <article><span>Colocação média</span><strong>{dna.avgPlacement ?? "—"}</strong><small>{dna.sampleSize} partidas</small></article>
            <article><span>Top 4</span><strong>{dna.top4Rate}%</strong><small>no contexto selecionado</small></article>
            <article><span>Win rate</span><strong>{dna.winRate}%</strong><small>{Math.round(dna.winRate*dna.sampleSize/100)} primeiros lugares</small></article>
            <article><span>Bottom 2</span><strong>{dna.bottom2Rate}%</strong><small>7º ou 8º lugar</small></article>
          </section>

          {error && <div className="profile-error">{error}</div>}

          <nav className="profile-tabs" aria-label="Seções do perfil">
            <div className="profile-tab-list">
              <button className={profileTab==="overview"?"active":""} onClick={()=>changeProfileTab("overview")}>Visão geral</button>
              <button className={profileTab==="review"?"active":""} onClick={()=>changeProfileTab("review")}>Review</button>
              <button className={profileTab==="meta"?"active":""} onClick={()=>changeProfileTab("meta")}>Meta pessoal</button>
              <button className={profileTab==="matches"?"active":""} onClick={()=>changeProfileTab("matches")}>Partidas</button>
              <button className={profileTab==="share"?"active":""} onClick={()=>changeProfileTab("share")}>Compartilhar</button>
            </div>
            <button className="copy-analysis-link" onClick={copyCurrentAnalysisLink}>
              {copiedAnalysisLink?"Link copiado ✓":"Copiar link"}
            </button>
          </nav>

          {profileTab==="overview"&&<>
            <ChibiIdentity
              matches={analysisMatches}
              onEvidence={showEvidence}
            />

            <ChibiInnovations
              matches={analysisMatches}
              staticData={staticData}
              onEvidence={showEvidence}
            />

            <NextSessionGoal
              playerKey={profile.player.platform+":"+profile.player.gameName+"#"+profile.player.tagLine}
              matches={analysisMatches}
              onEvidence={showEvidence}
            />
          </>}

          {profileTab==="review"&&<>
            <ChibiReview
              matches={analysisMatches}
              staticData={staticData}
              journalVersion={journalVersion}
              onEvidence={showEvidence}
            />
            <StyleShift matches={analysisMatches}/>
          </>}

          {profileTab==="meta"&&<>
            <PersonalVsGlobalMeta
              matches={analysisMatches}
              setNumber={currentSet}
              queueId={metaQueueId}
              staticData={staticData}
              onEvidence={showEvidence}
            />

            <PatchAdaptation
              matches={analysisMatches}
              onEvidence={showEvidence}
            />
          </>}

          {profileTab==="share"&&<ChibiShareCard
            profile={profile}
            dna={dna}
            matches={analysisMatches}
            staticData={staticData}
            shareUrl={window.location.href}
          />}

          {profileTab==="matches"&&<div className="content-grid">
            <section className="panel history" id="match-history">
              <div className="panel-title">
                <div><span>PARTIDAS RIOT</span><h2>Histórico recente</h2></div>
                <small>{visibleMatches.length} exibidas</small>
              </div>

              {evidenceIds?.length&&<div className="evidence-banner">
                <div>
                  <span>EVIDÊNCIA ATIVA</span>
                  <strong>{evidenceLabel}</strong>
                  <small>{visibleMatches.length} partida{visibleMatches.length===1?"":"s"} relacionada{visibleMatches.length===1?"":"s"}</small>
                </div>
                <button onClick={clearEvidence}>Mostrar contexto completo</button>
              </div>}

              <div className="match-list">
                {visibleMatches.map((match)=>(
                  <button className="match-row match-button" key={match.id} onClick={()=>openMatch(match)}>
                    <div className={"placement "+placementClass(match.placement)}>{match.placement}º</div>

                    <div className="match-main">
                      <strong>{activeTraits(match).slice(0,2).map((t)=>traitLabel(t,staticData)).filter(Boolean).join(" · ") || "Board TFT"}</strong>

                      <div className="trait-row">
                        {activeTraits(match).slice(0,5).map((trait)=>{
                          const entry=staticEntry(staticData?.traits,trait.name);
                          const image=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
                          return <span className={"trait-chip style-"+Math.max(0,trait.style)} key={trait.name}>
                            {image&&<img src={image} alt=""/>}
                            {traitLabel(trait,staticData)} {trait.numUnits}
                          </span>;
                        })}
                      </div>

                      <div className="board-row">
                        {match.units.slice(0,9).map((unit,index)=><UnitVisual unit={unit} staticData={staticData} compact key={unit.characterId+index}/>)}
                      </div>
                    </div>

                    <div className="match-meta">
                      <span>{formatWhen(match.playedAt)} · Nível {match.level}</span>
                      <strong>{match.damageToPlayers} dano</strong>
                      <small>{match.goldLeft}g</small>
                    </div>
                  </button>
                ))}
              </div>

              {!evidenceIds?.length&&hasMore && <button className="load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Carregando..." : "Carregar mais partidas"}</button>}
            </section>

            <aside className="panel insights dna-panel">
              <div className="panel-title">
                <div><span>CHIBI DNA</span><h2>Seu padrão recente</h2></div>
                <small>{dna.sampleSize} partidas</small>
              </div>

              <div className="placement-strip" aria-label="Colocações recentes">
                {dna.placements.slice(0,12).map((p,index)=>(
                  <span className={placementClass(p)} key={index} title={(index+1)+"ª partida mais recente: "+p+"º"}>{p}</span>
                ))}
              </div>

              <div className="dna-grid">
                <article>
                  <span>Consistência</span>
                  <strong>{dna.consistency}%</strong>
                  <small>variação das colocações</small>
                </article>
                <article>
                  <span>Flexibilidade</span>
                  <strong>{dna.flexibility}%</strong>
                  <small>diversidade de linhas</small>
                </article>
                <article>
                  <span>Conversão</span>
                  <strong>{dna.conversion}%</strong>
                  <small>Top 4 que viraram 1º</small>
                </article>
                <article>
                  <span>Estabilidade</span>
                  <strong>{dna.stability}%</strong>
                  <small>evitou Bottom 2</small>
                </article>
              </div>

              <p className="dna-disclaimer">Indicadores descritivos da amostra carregada. Não são MMR, elo alternativo nem avaliação oficial da Riot.</p>

              <div className="dna-insights">
                {dna.insights.map((insight)=>{
                  const subject=insight.subject
                    ? staticEntry(staticData?.traits,insight.subject)?.name || fallbackTraitName(insight.subject)
                    : "";
                  return <article className={"insight "+insight.tone} key={insight.id}>
                    <div className="insight-head">
                      <b>{insight.title}</b>
                      <span>{insight.confidence}</span>
                    </div>
                    {subject&&<strong className="insight-subject">{subject}</strong>}
                    <p>{insight.body}</p>
                    <small>{insight.evidence}</small>
                  </article>;
                })}
              </div>
            </aside>
          </div>}
        </main>
      )}

      {(matchLoading || selectedMatch || matchError) && (
        <div className="match-overlay" onClick={()=>{setSelectedMatch(null);setOpenedMatch(null);setMatchError("");}}>
          <section className="match-modal" onClick={(e)=>e.stopPropagation()}>
            <button className="match-close" onClick={()=>{setSelectedMatch(null);setOpenedMatch(null);setMatchError("");}}>×</button>
            {matchLoading && <div className="match-state">Carregando detalhes da partida...</div>}
            {matchError && <div className="match-state error">{matchError}</div>}

            {selectedMatch && <>
              <div className="panel-title">
                <div>
                  <span>DETALHES DA PARTIDA</span>
                  <h2>{displaySetName(selectedMatch.match.setName,selectedMatch.match.setNumber)}</h2>
                </div>
                <small>{queueLabel(staticData,selectedMatch.match.queueId)} · {selectedMatch.match.participants.length} jogadores</small>
              </div>

              {openedMatch&&<MatchJournal
                matchId={openedMatch.id}
                placement={openedMatch.placement}
                onSaved={()=>setJournalVersion((value)=>value+1)}
              />}

              {openedMatch&&<BoardCounterfactual
                target={openedMatch}
                history={analysisMatches}
                staticData={staticData}
                onEvidence={showCounterEvidence}
              />}

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
            </>}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
