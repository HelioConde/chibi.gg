import { useEffect, useMemo, useState } from "react";
import { fetchTftMeta, TftGlobalMeta, TftMatch } from "../api/tft";
import { buildPersonalMeta } from "../analysis/chibiProduct";
import { staticEntry, TftStaticData } from "../tftStatic";

type Props={
  matches:TftMatch[];
  setNumber:number|null;
  queueId:number|null;
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
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

function signed(value:number,unit=""){
  const rounded=Math.round(value*10)/10;
  return (rounded>0?"+":"")+rounded+unit;
}

export default function PersonalVsGlobalMeta({matches,setNumber,queueId,staticData,onEvidence}:Props){
  const [meta,setMeta]=useState<TftGlobalMeta|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const personal=useMemo(()=>buildPersonalMeta(matches),[matches]);

  useEffect(()=>{
    let cancelled=false;
    if(!setNumber){
      setMeta(null);
      return;
    }

    setLoading(true);
    setError("");

    fetchTftMeta(setNumber,queueId,2,30)
      .then(data=>{if(!cancelled)setMeta(data);})
      .catch(err=>{
        if(!cancelled){
          setMeta(null);
          setError(err instanceof Error?err.message:"Meta indisponível");
        }
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[setNumber,queueId]);

  const comparisons=useMemo(()=>{
    if(!meta) return [];
    const globalById=new Map(meta.traits.map(row=>[row.id,row]));
    return personal
      .map(line=>{
        const global=globalById.get(line.id);
        if(!global) return null;
        return {
          personal:line,
          global,
          placementDelta:+(line.avgPlacement-global.averagePlacement).toFixed(2),
          top4Delta:+(line.top4Rate-global.top4Rate).toFixed(1),
        };
      })
      .filter(Boolean) as Array<{
        personal:(typeof personal)[number];
        global:TftGlobalMeta["traits"][number];
        placementDelta:number;
        top4Delta:number;
      }>;
  },[personal,meta]);

  const globalLeaders=useMemo(()=>{
    if(!meta) return [];
    return meta.traits
      .filter(row=>row.games>=12)
      .slice()
      .sort((a,b)=>a.averagePlacement-b.averagePlacement||b.games-a.games)
      .slice(0,4);
  },[meta]);

  const maturity=meta
    ? meta.sampleParticipants>=1000?"robusta"
      : meta.sampleParticipants>=250?"crescendo"
      : "inicial"
    : "inicial";

  return <section className="panel global-meta-card">
    <div className="global-meta-head">
      <div>
        <span>SEU META × CHIBI DATASET</span>
        <h2>O que funciona para você versus o que aparece na base</h2>
      </div>
      <div className={"dataset-badge "+maturity}>
        <strong>{meta?.sampleParticipants??0}</strong>
        <small>participantes observados</small>
      </div>
    </div>

    {loading&&<div className="global-meta-state">Atualizando comparação agregada...</div>}

    {!loading&&error&&<div className="global-meta-state warning">
      O dataset agregado ainda não está disponível neste projeto. Seu Meta pessoal continua funcionando normalmente.
    </div>}

    {!loading&&!error&&meta&&meta.sampleParticipants<250&&<div className="dataset-warning">
      <strong>Base em construção</strong>
      <span>Comparações com menos de 3 partidas suas ou 20 observações agregadas aparecem apenas como “Sinal inicial”.</span>
    </div>}

    {!loading&&!error&&meta&&<>
      {comparisons.length>0?(
        <div className="personal-global-list">
          {comparisons.slice(0,4).map(row=>{
            const trusted=row.personal.games>=3 && row.global.games>=20;
            const better=trusted && row.placementDelta<-.35;
            const worse=trusted && row.placementDelta>.35;
            const status=!trusted?"Sinal inicial":better?"Seu diferencial":worse?"Base > pessoal":"Alinhado";
            return <article className={"personal-global-row "+(!trusted?"early":better?"better":worse?"worse":"even")} key={row.personal.id}>
              <div className="pg-title">
                <div>
                  <strong>{traitName(row.personal.id,staticData)}</strong>
                  <small>{row.personal.games} partidas suas · {row.global.games} observações agregadas</small>
                </div>
                <span>{status}</span>
              </div>

              <div className="pg-metrics">
                <div>
                  <span>Sua média</span>
                  <strong>{row.personal.avgPlacement}</strong>
                </div>
                <div>
                  <span>Base Chibi</span>
                  <strong>{row.global.averagePlacement}</strong>
                </div>
                <div>
                  <span>Δ colocação</span>
                  <strong>{signed(row.placementDelta)}</strong>
                </div>
                <div>
                  <span>Δ Top 4</span>
                  <strong>{signed(row.top4Delta,"%")}</strong>
                </div>
              </div>

              <button onClick={()=>onEvidence(row.personal.matchIds,"Seu Meta vs base · "+traitName(row.personal.id,staticData))}>
                Ver suas evidências
              </button>
            </article>;
          })}
        </div>
      ):(
        <div className="global-meta-state">
          Ainda não há interseção suficiente entre suas linhas repetidas e o dataset agregado.
        </div>
      )}

      {globalLeaders.length>0&&<div className="global-leaders">
        <div className="global-leaders-head">
          <span>DESTAQUES OBSERVADOS NO CHIBI</span>
          <small>não é tier list oficial</small>
        </div>
        <div>
          {globalLeaders.map((row,index)=>(
            <article key={row.id}>
              <span>{index+1}</span>
              <div>
                <strong>{traitName(row.id,staticData)}</strong>
                <small>{row.games} jogos · Top 4 {row.top4Rate}%</small>
              </div>
              <b>{row.averagePlacement}</b>
            </article>
          ))}
        </div>
      </div>}

      <p className="global-meta-disclaimer">
        O Chibi Dataset é construído com observações anônimas das partidas consultadas no site. Ele não representa toda a população de TFT e não substitui dados oficiais da Riot.
      </p>
    </>}
  </section>;
}
