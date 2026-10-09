import { useEffect, useMemo, useRef, useState } from "react";
import { RecentPlayer } from "../recentPlayers";
import { profileIconUrl, TftStaticData, TftStaticEntry } from "../tftStatic";
import { useI18n } from "../i18n";

type Category="champions"|"traits"|"items";

type Props={
  staticData:TftStaticData|null;
  recentPlayers:RecentPlayer[];
  onOpenRecent:(player:RecentPlayer)=>void;
  onOpenStats:(category:Category,query:string)=>void;
  onSearchPlayer:(riotId:string)=>void;
  onOpenPage:(page:"meta"|"comps"|"stats"|"builder"|"overlay")=>void;
  onPrepare:()=>void;
};

type StaticResult={
  category:Category;
  id:string;
  name:string;
  entry:TftStaticEntry;
};

function normalize(value:string){
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");
}

function rowsFrom(data:Record<string,TftStaticEntry>|undefined,category:Category){
  return Object.entries(data||{}).map(([id,entry])=>({
    category,
    id,
    name:String(entry?.name||id),
    entry,
  } satisfies StaticResult));
}

export default function GlobalSearch({
  staticData,
  recentPlayers,
  onOpenRecent,
  onOpenStats,
  onSearchPlayer,
  onOpenPage,
  onPrepare,
}:Props){
  const { t } = useI18n();
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const inputRef=useRef<HTMLInputElement|null>(null);
  const triggerRef=useRef<HTMLButtonElement|null>(null);
  const dialogRef=useRef<HTMLElement|null>(null);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();
        onPrepare();
        setOpen(true);
        requestAnimationFrame(()=>inputRef.current?.focus());
      }
      if(event.key==="Escape"&&open){
        setOpen(false);
        setQuery("");
        requestAnimationFrame(()=>triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[open,onPrepare]);

  const staticRows=useMemo(()=>[
    ...rowsFrom(staticData?.champions,"champions"),
    ...rowsFrom(staticData?.traits,"traits"),
    ...rowsFrom(staticData?.items,"items"),
  ],[staticData]);

  const normalized=normalize(query.trim());

  const entityResults=useMemo(()=>{
    if(normalized.length<2)return [];
    return staticRows
      .filter(row=>normalize(row.name).includes(normalized)||normalize(row.id).includes(normalized))
      .sort((a,b)=>{
        const aName=normalize(a.name);
        const bName=normalize(b.name);
        const aExact=aName===normalized?0:aName.startsWith(normalized)?1:2;
        const bExact=bName===normalized?0:bName.startsWith(normalized)?1:2;
        return aExact-bExact||a.name.localeCompare(b.name);
      })
      .slice(0,8);
  },[normalized,staticRows]);

  const recentResults=useMemo(()=>{
    if(!normalized)return recentPlayers.slice(0,5);
    return recentPlayers
      .filter(player=>normalize(player.gameName+"#"+player.tagLine).includes(normalized))
      .slice(0,5);
  },[recentPlayers,normalized]);

  function close(){
    setOpen(false);
    setQuery("");
    requestAnimationFrame(()=>triggerRef.current?.focus());
  }

  useEffect(()=>{
    if(!open)return;
    const handleTab=(event:KeyboardEvent)=>{
      if(event.key!=="Tab"||!dialogRef.current)return;
      const candidates=Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]),input:not([disabled]),a[href],select:not([disabled])"
      ));
      if(!candidates.length)return;
      const first=candidates[0];
      const last=candidates[candidates.length-1];
      if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown",handleTab);
    return ()=>document.removeEventListener("keydown",handleTab);
  },[open]);

  function selectEntity(row:StaticResult){
    onOpenStats(row.category,row.name);
    close();
  }

  function submit(){
    const value=query.trim();
    if(!value)return;
    if(value.includes("#")){
      onSearchPlayer(value);
      close();
      return;
    }
    if(entityResults[0]){
      selectEntity(entityResults[0]);
    }
  }

  return <>
    <button ref={triggerRef} type="button" className="global-search-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{
      onPrepare();
      setOpen(true);
      requestAnimationFrame(()=>inputRef.current?.focus());
    }}>
      <span>⌕</span>
      <b>{t("search.trigger")}</b>
      <kbd>Ctrl K</kbd>
    </button>

    {open&&<div className="global-search-backdrop" onClick={close}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("search.trigger")} className="global-search-modal" onClick={event=>event.stopPropagation()}>
        <div className="global-search-input">
          <span>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={event=>setQuery(event.target.value)}
            onKeyDown={event=>{if(event.key==="Enter")submit();}}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
          />
          {query&&<button type="button" aria-label={t("search.clear")=== "search.clear" ? "Limpar pesquisa" : t("search.clear")} onClick={()=>{setQuery("");inputRef.current?.focus();}}>×</button>}
          <button type="button" className="global-search-close" aria-label="Fechar pesquisa" onClick={close}>Fechar</button>
        </div>

        {!query&&<div className="global-search-pages">
          <button onClick={()=>{onOpenPage("meta");close();}}><span>{t("nav.meta")}</span><small>{t("search.metaDesc")}</small></button>
          <button onClick={()=>{onOpenPage("comps");close();}}><span>{t("nav.comps")}</span><small>{t("search.compsDesc")}</small></button>
          <button onClick={()=>{onOpenPage("stats");close();}}><span>{t("nav.statistics")}</span><small>{t("search.statsDesc")}</small></button>
          <button onClick={()=>{onOpenPage("builder");close();}}><span>{t("nav.builder")}</span><small>{t("search.builderDesc")}</small></button>
          <button onClick={()=>{onOpenPage("overlay");close();}}><span>Overlay</span><small>{t("search.overlayDesc")}</small></button>
        </div>}

        {recentResults.length>0&&<div className="global-search-section">
          <div className="global-search-section-head"><span>{t("search.profiles")}</span><small>{t("search.recent")}</small></div>
          {recentResults.map(player=>(
            <button className="global-search-result profile-result" onClick={()=>{onOpenRecent(player);close();}} key={player.platform+":"+player.gameName+"#"+player.tagLine}>
              <span className="search-result-avatar">
                {staticData&&player.profileIconId
                  ?<img src={profileIconUrl(staticData.version,player.profileIconId)} alt="" onError={(e)=>{e.currentTarget.style.display="none";}}/>
                  :player.gameName.slice(0,1).toUpperCase()}
              </span>
              <span><strong>{player.gameName}<em>#{player.tagLine}</em></strong><small>{player.platform.toUpperCase()} · {player.rankLabel}</small></span>
              <b>{player.averagePlacement??"—"}</b>
            </button>
          ))}
        </div>}

        {entityResults.length>0&&<div className="global-search-section">
          <div className="global-search-section-head"><span>TFT</span><small>{t("search.results",{count:entityResults.length})}</small></div>
          {entityResults.map(row=>(
            <button className="global-search-result" onClick={()=>selectEntity(row)} key={row.category+":"+row.id}>
              <span className="search-result-type">{row.category.slice(0,1).toUpperCase()}</span>
              <span><strong>{row.name}</strong><small>{row.category}</small></span>
              <em>→</em>
            </button>
          ))}
        </div>}

        {query.includes("#")&&<button className="global-search-player-action" onClick={submit}>
          {t("search.exactRiotId")} <strong>{query}</strong> →
        </button>}

        {query&&!query.includes("#")&&!entityResults.length&&!recentResults.length&&<div className="global-search-empty">
          {t("search.empty")}
        </div>}
      </section>
    </div>}
  </>;
}
