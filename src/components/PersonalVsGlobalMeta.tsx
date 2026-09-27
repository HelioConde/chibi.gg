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

  const trusted=useMemo(
    ()=>comparisons.filter(row=>row.personal.games>=3&&row.global.games>=20),
    [comparisons],
  );

  const strongest=useMemo(
    ()=>trusted.slice().sort((a,b)=>Math.abs(b.placementDelta)-Math.abs(a.placementDelta))[0]||null,
    [trusted],
  );

  const advantage=useMemo(
    ()=>trusted.filter(row=>row.placementDelta<-.35).sort((a,b)=>a.placementDelta-b.placementDelta)[0]||null,
    [trusted],
  );

  const opportunity=useMemo(
    ()=>trusted.filter(row=>row.placementDelta>.35).sort((a,b)=>b.placementDelta-a.placementDelta)[0]||null,
    [trusted],
  );

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

  const coach=useMemo(()=>{
    if(!meta){
      return {
        title:"Ainda sem comparação agregada",
        body:"Seu perfil continua funcionando normalmente. Esta área depende de uma base comparável do mesmo contexto.",
        experiment:"Continue acumulando partidas e volte quando houver interseção suficiente com o Chibi Dataset.",
        ids:[] as string[],
      };
    }

    if(!trusted.length){
      return {
        title:"Ainda é cedo para comparar você com a base",
        body:"O Chibi exige pelo menos 3 partidas suas e 20 observações agregadas na mesma linha antes de tratar a diferença como leitura confiável.",
        experiment:"Escolha uma linha recorrente e acumule uma amostra maior antes de reagir ao delta.",
        ids:[] as string[],
      };
    }

    if(opportunity){
      const name=traitName(opportunity.personal.id,staticData);
      return {
        title:"Investigue "+name+" antes de copiar a base",
        body:`Sua colocação média ficou ${opportunity.placementDelta.toFixed(2)} abaixo da base observada nessa linha. Isso mostra onde investigar, não prova que a linha é ruim para você.`,
        experiment:"Compare seus boards finais nessa linha com suas melhores partidas e mude apenas uma variável observável por vez.",
        ids:opportunity.personal.matchIds,
      };
    }

    if(advantage){
      const name=traitName(advantage.personal.id,staticData);
      return {
        title:"Use "+name+" como referência pessoal",
        body:`Seu histórico ficou ${Math.abs(advantage.placementDelta).toFixed(2)} melhor que a base observada nessa linha, com delta de Top 4 ${signed(advantage.top4Delta,"%")}.`,
        experiment:"Repita a linha apenas quando os mesmos sinais de entrada aparecerem e anote quando ela deixar de funcionar.",
        ids:advantage.personal.matchIds,
      };
    }

    return {
      title:"Seu resultado está próximo da base observada",
      body:"As linhas confiáveis não mostraram uma diferença grande de colocação média.",
      experiment:"Use a base como contexto, não como direção automática. Priorize os sinais do seu próprio histórico.",
      ids:strongest?.personal.matchIds||[],
    };
  },[meta,trusted,opportunity,advantage,strongest,staticData]);

  return <section className="panel global-meta-card comparison-coach">
    <div className="global-meta-head comparison-coach-head">
      <div>
        <span>COMPARAÇÕES</span>
        <h2>O que parece ser seu versus o que é só popular</h2>
        <p>Primeiro mostramos diferenças que têm amostra suficiente. O dataset completo fica como evidência.</p>
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

    {!loading&&!error&&meta&&<article className="comparison-coach-hero">
      <div>
        <span>LEITURA PRINCIPAL</span>
        <h3>{coach.title}</h3>
        <p>{coach.body}</p>
        {coach.ids.length>0&&<button onClick={()=>onEvidence(coach.ids,"Comparações · leitura principal")}>Ver suas partidas</button>}
      </div>
      <aside>
        <small>PRÓXIMO EXPERIMENTO</small>
        <strong>{coach.experiment}</strong>
      </aside>
    </article>}

    {!loading&&!error&&meta&&<div className="comparison-signal-row">
      <article className={advantage?"positive":"neutral"}>
        <span>ONDE VOCÊ ESTÁ MELHOR</span>
        <h3>{advantage?traitName(advantage.personal.id,staticData):"Nenhuma vantagem confiável ainda"}</h3>
        <p>{advantage
          ? `Média pessoal ${advantage.personal.avgPlacement} vs base ${advantage.global.averagePlacement} · Δ ${signed(advantage.placementDelta)}.`
          : "Não há linha com diferença positiva grande e amostra suficiente."}</p>
        {advantage&&<button onClick={()=>onEvidence(advantage.personal.matchIds,"Comparações · vantagem pessoal")}>Ver evidências</button>}
      </article>

      <article className={opportunity?"warning":"neutral"}>
        <span>ONDE VALE INVESTIGAR</span>
        <h3>{opportunity?traitName(opportunity.personal.id,staticData):"Nenhum gap dominante"}</h3>
        <p>{opportunity
          ? `Média pessoal ${opportunity.personal.avgPlacement} vs base ${opportunity.global.averagePlacement} · Δ ${signed(opportunity.placementDelta)}.`
          : "Nenhuma linha confiável ficou muito atrás da base observada."}</p>
        {opportunity&&<button onClick={()=>onEvidence(opportunity.personal.matchIds,"Comparações · oportunidade")}>Ver evidências</button>}
      </article>
    </div>}

    {!loading&&!error&&meta&&meta.sampleParticipants<250&&<div className="dataset-warning">
      <strong>Base ainda em construção</strong>
      <span>Diferenças com pouca amostra continuam aparecendo apenas como sinal inicial dentro dos detalhes.</span>
    </div>}

    {!loading&&!error&&meta&&<details className="comparison-evidence-layer">
      <summary>
        <span><b>Ver comparações completas</b><small>Todas as linhas, deltas, destaques do dataset e metodologia</small></span>
        <em>Evidências</em>
      </summary>

      <div className="comparison-evidence-body">
        {comparisons.length>0?(
          <div className="personal-global-list">
            {comparisons.slice(0,6).map(row=>{
              const isTrusted=row.personal.games>=3 && row.global.games>=20;
              const better=isTrusted && row.placementDelta<-.35;
              const worse=isTrusted && row.placementDelta>.35;
              const status=!isTrusted?"Sinal inicial":better?"Seu diferencial":worse?"Base > pessoal":"Alinhado";
              return <article className={"personal-global-row "+(!isTrusted?"early":better?"better":worse?"worse":"even")} key={row.personal.id}>
                <div className="pg-title">
                  <div>
                    <strong>{traitName(row.personal.id,staticData)}</strong>
                    <small>{row.personal.games} partidas suas · {row.global.games} observações agregadas</small>
                  </div>
                  <span>{status}</span>
                </div>

                <div className="pg-metrics">
                  <div><span>Sua média</span><strong>{row.personal.avgPlacement}</strong></div>
                  <div><span>Base Chibi</span><strong>{row.global.averagePlacement}</strong></div>
                  <div><span>Δ colocação</span><strong>{signed(row.placementDelta)}</strong></div>
                  <div><span>Δ Top 4</span><strong>{signed(row.top4Delta,"%")}</strong></div>
                </div>

                <button onClick={()=>onEvidence(row.personal.matchIds,"Seu Meta vs base · "+traitName(row.personal.id,staticData))}>
                  Ver suas evidências
                </button>
              </article>;
            })}
          </div>
        ):(
          <div className="global-meta-state">Ainda não há interseção suficiente entre suas linhas repetidas e o dataset agregado.</div>
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
      </div>
    </details>}
  </section>;
}
