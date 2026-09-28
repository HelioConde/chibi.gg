import { useEffect, useMemo, useState } from "react";
import { fetchTftMeta, TftGlobalMeta, TftGlobalTraitStat } from "../api/tft";
import { staticEntry, TftStaticData } from "../tftStatic";
import DDragonArt from "./DDragonArt";

type Props={
  staticData:TftStaticData|null;
  hasProfile:boolean;
  onBack:()=>void;
  onOpenComps?:()=>void;
  onOpenStats?:()=>void;
  onOpenTier?:()=>void;
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

function confidence(games:number){
  if(games>=50) return {label:"alta",className:"high"};
  if(games>=20) return {label:"média",className:"medium"};
  return {label:"inicial",className:"low"};
}

function score(row:TftGlobalTraitStat){
  const sample=Math.min(1,row.games/50);
  const placement=Math.max(0,Math.min(1,(8.5-row.averagePlacement)/7.5));
  const top4=Math.max(0,Math.min(1,row.top4Rate/100));
  return placement*.45+top4*.35+sample*.2;
}

export default function GlobalMetaPage({
  staticData,
  hasProfile,
  onBack,
  onOpenComps,
  onOpenStats,
  onOpenTier,
}:Props){
  const [queueId,setQueueId]=useState<number|null>(1100);
  const [meta,setMeta]=useState<TftGlobalMeta|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftMeta(0,queueId,2,50)
      .then(data=>{if(!cancelled)setMeta(data);})
      .catch(err=>{
        if(!cancelled){
          setMeta(null);
          setError(err instanceof Error?err.message:"Não foi possível carregar o meta.");
        }
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[queueId]);

  const rows=useMemo(
    ()=>meta?.traits.slice().sort((a,b)=>score(b)-score(a)||b.games-a.games)||[],
    [meta]
  );

  const mostObserved=useMemo(
    ()=>rows.slice().sort((a,b)=>b.games-a.games)[0]||null,
    [rows]
  );

  const established=useMemo(
    ()=>rows.filter(row=>row.games>=20).sort((a,b)=>a.averagePlacement-b.averagePlacement||b.games-a.games)[0]||null,
    [rows]
  );

  const emerging=useMemo(
    ()=>rows.filter(row=>row.games>=5&&row.games<20).sort((a,b)=>a.averagePlacement-b.averagePlacement||b.top4Rate-a.top4Rate)[0]||null,
    [rows]
  );

  const maturity=meta
    ? meta.sampleParticipants>=1000?"robusta"
      : meta.sampleParticipants>=250?"crescendo"
      : "inicial"
    : "inicial";

  return <main className="global-meta-page">
    <div className="global-meta-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI DATASET</span>
        <h1>Seu ponto de entrada<br/><em>para o meta do TFT.</em></h1>
        <p>Comps, statistics, tier list e traits observadas em um único lugar, sempre com tamanho da amostra e confiança visíveis.</p>
        <DDragonArt
          staticData={staticData}
          setNumber={meta?.context.setNumber}
          variant="ribbon"
          label="Assets oficiais Riot"
        />
      </div>

      <div className={"meta-dataset-card "+maturity}>
        <span>BASE ATUAL</span>
        <strong>{meta?.sampleParticipants??0}</strong>
        <small>participantes observados</small>
        <b>{maturity}</b>
      </div>
    </div>

    <section className="meta-hub-links">
      <button className="active">
        <span>VISÃO GERAL</span>
        <strong>Meta agora</strong>
        <small>sinais do Chibi Dataset</small>
      </button>
      <button onClick={onOpenComps}>
        <span>COMPS</span>
        <strong>Boards observados</strong>
        <small>desempenho + compatibilidade pessoal</small>
      </button>
      <button onClick={onOpenStats}>
        <span>STATISTICS</span>
        <strong>Champions / Traits / Items / Augments</strong>
        <small>números completos e comparação pessoal</small>
      </button>
      <button onClick={onOpenTier}>
        <span>TIER LIST</span>
        <strong>S / A / B / C</strong>
        <small>visualização do sinal composto</small>
      </button>
    </section>

    <div className="meta-toolbar">
      <div>
        <button className={queueId===1100?"active":""} onClick={()=>setQueueId(1100)}>Ranqueada</button>
        <button className={queueId==null?"active":""} onClick={()=>setQueueId(null)}>Todas as filas</button>
      </div>
      <span>{meta?.context.setNumber?("Set "+meta.context.setNumber):"Aguardando dados"}</span>
    </div>

    {loading&&<section className="panel meta-page-state">Carregando sinais do Chibi Dataset...</section>}
    {!loading&&error&&<section className="panel meta-page-state error">Não foi possível carregar o dataset agora.</section>}

    {!loading&&!error&&meta&&<>
      <section className="meta-signal-grid">
        <article className="panel">
          <span>MAIS OBSERVADO</span>
          <h2>{mostObserved?traitName(mostObserved.id,staticData):"Sem amostra"}</h2>
          <p>{mostObserved?(mostObserved.games+" partidas · média "+mostObserved.averagePlacement+" · Top 4 "+mostObserved.top4Rate+"%"):"O dataset ainda está começando."}</p>
        </article>

        <article className="panel established">
          <span>SINAL ESTABELECIDO</span>
          <h2>{established?traitName(established.id,staticData):"Ainda não disponível"}</h2>
          <p>{established?(established.games+" partidas · média "+established.averagePlacement+" · Top 4 "+established.top4Rate+"%"):"Precisamos de pelo menos 20 observações na mesma linha."}</p>
        </article>

        <article className="panel emerging">
          <span>SINAL EMERGENTE</span>
          <h2>{emerging?traitName(emerging.id,staticData):"Ainda não disponível"}</h2>
          <p>{emerging?(emerging.games+" partidas · média "+emerging.averagePlacement+" · Top 4 "+emerging.top4Rate+"%"):"Nenhuma linha pequena o suficiente para chamar de emergente."}</p>
        </article>
      </section>

      <section className="panel meta-explorer">
        <div className="meta-explorer-head">
          <div>
            <span>EXPLORADOR</span>
            <h2>Traits observados</h2>
          </div>
          <small>ordenado por sinal composto, não por tier</small>
        </div>

        <div className="meta-table-head">
          <span>Trait</span><span>Amostra</span><span>Média</span><span>Top 4</span><span>Win</span><span>Nível</span><span>Confiança</span>
        </div>

        <div className="meta-table">
          {rows.map(row=>{
            const conf=confidence(row.games);
            return <article key={row.id}>
              <div className="meta-trait-name">
                <strong>{traitName(row.id,staticData)}</strong>
                <small>{row.id}</small>
              </div>
              <b>{row.games}</b>
              <b>{row.averagePlacement}</b>
              <b>{row.top4Rate}%</b>
              <b>{row.winRate}%</b>
              <b>{row.averageLevel}</b>
              <span className={"meta-confidence "+conf.className}>{conf.label}</span>
            </article>;
          })}
        </div>

        {!rows.length&&<div className="meta-page-state">Ainda não há observações suficientes nesse contexto.</div>}

        <p className="global-meta-disclaimer">
          O Chibi Dataset é formado apenas pelas partidas consultadas no site. Ele não representa toda a população de TFT e não deve ser interpretado como tier list oficial.
        </p>
      </section>
    </>}
  </main>;
}
