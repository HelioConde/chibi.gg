import { useEffect, useMemo, useState } from "react";
import { fetchTftComps, TftGlobalComps, TftMatch } from "../api/tft";
import { buildChibiFlexOptions } from "../analysis/chibiFlex";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";

type Props={
  matches:TftMatch[];
  setNumber:number|null;
  queueId:number|null;
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder:(unitIds:string[])=>void;
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

function unitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

export default function ChibiFlex({
  matches,
  setNumber,
  queueId,
  staticData,
  onEvidence,
  onOpenBuilder,
}:Props){
  const [data,setData]=useState<TftGlobalComps|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftComps(setNumber||0,queueId,2,18)
      .then(result=>{if(!cancelled)setData(result);})
      .catch(err=>{
        if(!cancelled){
          setData(null);
          setError(err instanceof Error?err.message:"Não foi possível montar linhas personalizadas agora.");
        }
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[setNumber,queueId]);

  const options=useMemo(
    ()=>buildChibiFlexOptions(data?.comps||[],matches),
    [data,matches],
  );

  const sampleTone=data
    ? data.sampleParticipants>=1000?"robusta"
      :data.sampleParticipants>=250?"crescendo"
      :"inicial"
    :"inicial";

  return <section className="panel chibi-flex">
    <div className="chibi-flex-head">
      <div>
        <span>CHIBI FLEX</span>
        <h2>3 linhas que fazem sentido estudar agora</h2>
        <p>O Chibi cruza comps observadas no patch com suas traits, unidades e partidas recentes. A ideia é reduzir o espaço de busca — não mandar você forçar uma comp.</p>
      </div>
      <div className={"chibi-flex-sample "+sampleTone}>
        <strong>{data?.sampleParticipants??0}</strong>
        <small>participantes na base</small>
      </div>
    </div>

    {loading&&<div className="chibi-flex-state">Cruzando seu histórico com as comps observadas...</div>}
    {!loading&&error&&<div className="chibi-flex-state warning">O dataset de comps não respondeu agora. Seu Chibi Review continua funcionando normalmente.</div>}

    {!loading&&!error&&options.length===0&&<div className="chibi-flex-state">
      Ainda não há comps observadas suficientes para montar três linhas personalizadas neste contexto.
    </div>}

    {!loading&&!error&&options.length>0&&<div className="chibi-flex-grid">
      {options.map((option,index)=>{
        const title=option.traitIds.slice(0,2).map(id=>traitName(id,staticData)).filter(Boolean).join(" · ")||"Linha observada";
        return <article className={"chibi-flex-card role-"+option.role} key={option.id}>
          <div className="chibi-flex-rank">
            <span>{index+1}</span>
            <div>
              <small>{option.label}</small>
              <strong>{title}</strong>
            </div>
          </div>

          <div className="chibi-flex-units">
            {option.unitIds.slice(0,6).map(id=>{
              const entry=staticEntry(staticData?.champions,id);
              const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
              return <span title={unitName(id,staticData)} key={id}>
                {src?<img src={src} alt={unitName(id,staticData)} onError={(event)=>{event.currentTarget.style.display="none";}}/>:<b>{unitName(id,staticData).slice(0,2)}</b>}
              </span>;
            })}
          </div>

          <p>{option.reason}</p>

          <div className="chibi-flex-metrics">
            <span><small>TRAITS SUAS</small><b>{option.traitOverlap}%</b></span>
            <span><small>UNIDADES SUAS</small><b>{option.unitOverlap}%</b></span>
            <span><small>BASE</small><b>{option.globalAverage}</b><em>média</em></span>
            <span><small>TOP 4</small><b>{option.globalTop4}%</b></span>
          </div>

          <div className="chibi-flex-footer">
            <span>{option.globalGames} observações · confiança {option.confidence}</span>
            <div>
              {option.personalMatchIds.length>0&&<button onClick={()=>onEvidence(
                option.personalMatchIds,
                "Chibi Flex · "+title,
              )}>Seu histórico</button>}
              <button className="primary" onClick={()=>onOpenBuilder(option.unitIds)}>Abrir no Builder</button>
            </div>
          </div>
        </article>;
      })}
    </div>}

    <div className="chibi-flex-guardrail">
      <strong>Como usar:</strong>
      <span>olhe estas linhas quando o jogo já estiver oferecendo peças, itens ou traits compatíveis. O Chibi usa boards finais e seu histórico; ele não conhece sua loja, seus rolls ou seu timing exato durante a partida.</span>
    </div>
  </section>;
}
