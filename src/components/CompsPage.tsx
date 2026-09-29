import { useEffect, useMemo, useState } from "react";
import { fetchTftComps, TftGlobalComp, TftGlobalComps, TftMatch } from "../api/tft";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import DDragonArt from "./DDragonArt";
import { saveStudyShelfItem } from "../studyShelf";

type Props={
  staticData:TftStaticData|null;
  matches:TftMatch[];
  hasProfile:boolean;
  onBack:()=>void;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder?:(unitIds:string[])=>void;
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

function itemName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.items,id)?.name||clean(id);
}


function activeTraitIds(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,4)
    .map(trait=>trait.name);
}

function compName(comp:TftGlobalComp,staticData:TftStaticData|null){
  const names=comp.traits.slice(0,2).map(trait=>traitName(trait.id,staticData)).filter(Boolean);
  return names.join(" · ")||"Comp observada";
}

function personalFit(comp:TftGlobalComp,matches:TftMatch[]){
  if(!matches.length) return {score:0,traitOverlap:0,unitOverlap:0,matchIds:[] as string[]};

  const personalTraitCounts=new Map<string,number>();
  const personalUnitCounts=new Map<string,number>();

  for(const match of matches){
    for(const trait of activeTraitIds(match)){
      personalTraitCounts.set(trait,(personalTraitCounts.get(trait)||0)+1);
    }
    for(const unit of match.units){
      personalUnitCounts.set(unit.characterId,(personalUnitCounts.get(unit.characterId)||0)+1);
    }
  }

  const traitOverlap=comp.traits.reduce(
    (sum,trait)=>sum+Math.min(1,(personalTraitCounts.get(trait.id)||0)/Math.max(1,matches.length*.25)),
    0,
  )/Math.max(1,comp.traits.length);

  const unitOverlap=comp.units.reduce(
    (sum,unit)=>sum+Math.min(1,(personalUnitCounts.get(unit.id)||0)/Math.max(1,matches.length*.2)),
    0,
  )/Math.max(1,comp.units.length);

  const matchIds=matches
    .filter(match=>{
      const traits=new Set(activeTraitIds(match));
      const units=new Set(match.units.map(unit=>unit.characterId));
      const sharedTraits=comp.traits.filter(row=>traits.has(row.id)).length;
      const sharedUnits=comp.units.filter(row=>units.has(row.id)).length;
      return sharedTraits>=1||sharedUnits>=3;
    })
    .map(match=>match.id);

  return {
    score:Math.round((traitOverlap*.68+unitOverlap*.32)*100),
    traitOverlap:Math.round(traitOverlap*100),
    unitOverlap:Math.round(unitOverlap*100),
    matchIds,
  };
}

function performanceScore(comp:TftGlobalComp){
  const placement=Math.max(0,Math.min(1,(8.5-comp.averagePlacement)/7.5));
  const top4=Math.max(0,Math.min(1,comp.top4Rate/100));
  const sample=Math.min(1,comp.games/30);
  return placement*.45+top4*.35+sample*.2;
}

export default function CompsPage({
  staticData,
  matches,
  hasProfile,
  onBack,
  onEvidence,
  onOpenBuilder,
}:Props){
  const [queueId,setQueueId]=useState<number|null>(1100);
  const [data,setData]=useState<TftGlobalComps|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selectedCompId,setSelectedCompId]=useState<string|null>(null);
  const [shelfSavedId,setShelfSavedId]=useState<string>("");

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftComps(0,queueId,2,18)
      .then(result=>{if(!cancelled)setData(result);})
      .catch(err=>{
        if(!cancelled){
          setData(null);
          setError(err instanceof Error?err.message:"Não foi possível carregar as comps.");
        }
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[queueId]);

  const ranked=useMemo(()=>{
    return (data?.comps||[]).map(comp=>{
      const fit=personalFit(comp,matches);
      const global=performanceScore(comp);
      const confidence=comp.confidence==="alta"?1:comp.confidence==="média"?0.8:0.55;
      const personalized=hasProfile
        ? fit.score*.62+global*100*.23+confidence*15
        : global*100;
      return {...comp,fit,personalized};
    }).sort((a,b)=>b.personalized-a.personalized);
  },[data,matches,hasProfile]);

  const bestForYou=hasProfile?ranked[0]||null:null;
  const mostStable=useMemo(
    ()=>ranked.slice().sort((a,b)=>a.volatility-b.volatility||b.games-a.games)[0]||null,
    [ranked]
  );
  const mostPopular=useMemo(
    ()=>ranked.slice().sort((a,b)=>b.games-a.games)[0]||null,
    [ranked]
  );
  const emerging=useMemo(
    ()=>ranked.filter(comp=>comp.games>=3&&comp.games<20)
      .sort((a,b)=>a.averagePlacement-b.averagePlacement||b.top4Rate-a.top4Rate)[0]||null,
    [ranked]
  );

  const hero=bestForYou||mostPopular;
  const selectedComp=ranked.find(comp=>comp.id===selectedCompId)||hero||ranked[0]||null;
  const maturity=data
    ? data.sampleParticipants>=1000?"robusta"
      : data.sampleParticipants>=250?"crescendo"
      : "inicial"
    : "inicial";

  function saveCompToShelf(comp:typeof ranked[number]){
    saveStudyShelfItem({
      type:"comp",
      label:compName(comp,staticData),
      subtitle:comp.games+" jogos · média "+comp.averagePlacement+" · Top 4 "+comp.top4Rate+"%",
      unitIds:comp.units.slice(0,8).map(unit=>unit.id),
    });
    setShelfSavedId(comp.id);
  }

  function coreReason(comp:typeof ranked[number]){
    if(hasProfile&&comp.fit.score>=55){
      return "Você já mostrou familiaridade com "+comp.fit.traitOverlap+"% das traits centrais e "+comp.fit.unitOverlap+"% das unidades mais recorrentes.";
    }
    if(comp.confidence==="inicial"){
      return "O desempenho observado é interessante, mas a amostra ainda é pequena.";
    }
    return "A base observada mostra média "+comp.averagePlacement+" e Top 4 de "+comp.top4Rate+"%.";
  }

  return <main className="comps-page">
    <section className="comps-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI COMPS</span>
        <h1>{hasProfile?"O que faz sentido para você":"Comps com contexto"}<br/><em>sem mandar você forçar.</em></h1>
        <p>{hasProfile
          ?"O Chibi cruza o que aparece no dataset com o que você já jogou. A primeira resposta é compatibilidade, não tier."
          :"Veja identidades de board observadas com desempenho, estabilidade e confiança da amostra."}</p>
        <DDragonArt
          staticData={staticData}
          setNumber={data?.context.setNumber}
          championIds={hero?.units.map(unit=>unit.id)||[]}
          variant="ribbon"
          label="Champions · Data Dragon"
        />
      </div>

      <div className={"meta-dataset-card "+maturity}>
        <span>BASE ATUAL</span>
        <strong>{data?.sampleParticipants??0}</strong>
        <small>participantes observados</small>
        <b>{maturity}</b>
      </div>
    </section>

    <div className="meta-toolbar">
      <div>
        <button className={queueId===1100?"active":""} onClick={()=>setQueueId(1100)}>Ranqueada</button>
        <button className={queueId==null?"active":""} onClick={()=>setQueueId(null)}>Todas as filas</button>
      </div>
      <span>{data?.context.setNumber?("Set "+data.context.setNumber):"Aguardando dados"}</span>
    </div>

    {loading&&<section className="panel meta-page-state">Montando comps observadas...</section>}
    {!loading&&error&&<section className="panel meta-page-state error">Não foi possível carregar as comps agora.</section>}

    {!loading&&!error&&data&&<>
      {hero&&<section className="panel comp-answer-card">
        <div className="comp-answer-copy">
          <span>{hasProfile
            ? data.sampleParticipants<250
              ? "SINAL INICIAL PARA VOCÊ"
              : "MAIS COMPATÍVEL COM VOCÊ"
            : "MAIS OBSERVADA"}</span>
          <h2>{compName(hero,staticData)}</h2>
          <p>{coreReason(hero)}</p>
          {data.sampleParticipants<250&&<div className="comp-sample-warning">
            Base pequena: use esta comp como direção de revisão, não como ordem para forçar.
          </div>}

          <div className="comp-answer-actions">
            {hasProfile&&hero.fit.matchIds.length>0&&<button onClick={()=>onEvidence(hero.fit.matchIds,"Comp compatível · "+compName(hero,staticData))}>Ver seu histórico parecido</button>}
            {onOpenBuilder&&<button className="secondary" onClick={()=>onOpenBuilder(hero.units.slice(0,8).map(unit=>unit.id))}>Abrir no Builder</button>}
            <small>{hero.games} observações · confiança {hero.confidence}</small>
          </div>
        </div>

        <div className="comp-answer-metrics">
          <div><span>Média</span><strong>{hero.averagePlacement}</strong></div>
          <div><span>Top 4</span><strong>{hero.top4Rate}%</strong></div>
          <div><span>Win</span><strong>{hero.winRate}%</strong></div>
          {hasProfile&&<div className="fit"><span>Compatibilidade</span><strong>{hero.fit.score}</strong></div>}
        </div>

        <div className="comp-core-units">
          {hero.units.slice(0,8).map(unit=>{
            const entry=staticEntry(staticData?.champions,unit.id);
            const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
            return <div title={unitName(unit.id,staticData)} key={unit.id}>
              {image&&<img src={image} alt={unitName(unit.id,staticData)}/>}
              <span>{Math.round(unit.rate)}%</span>
            </div>;
          })}
        </div>

        <div className="comp-guardrail">
          <strong>Não force automaticamente.</strong>
          <span>Use esta leitura quando seu spot já estiver oferecendo peças/traits compatíveis. A base do Chibi descreve boards finais, não o timing das decisões.</span>
        </div>
      </section>}

      {selectedComp&&<section className="panel comp-guide-panel">
        <div className="comp-guide-head">
          <div>
            <span>COMP GUIDE · OBSERVADO</span>
            <h2>{compName(selectedComp,staticData)}</h2>
            <p>Não é uma receita fixa. É a forma mais recorrente como esta identidade apareceu no Chibi Dataset.</p>
          </div>
          <div className="comp-guide-context">
            <span>Nível médio</span><strong>{selectedComp.averageLevel}</strong>
            <span>Ouro final</span><strong>{selectedComp.averageGold}g</strong>
            <button className="comp-shelf-button" onClick={()=>saveCompToShelf(selectedComp)}>
              {shelfSavedId===selectedComp.id?"Salvo no Shelf ✓":"Salvar no Study Shelf"}
            </button>
          </div>
        </div>

        <div className="comp-guide-grid">
          <article>
            <span>CORE UNITS + ITENS</span>
            <div className="comp-guide-units">
              {selectedComp.units.slice(0,8).map(unit=>{
                const entry=staticEntry(staticData?.champions,unit.id);
                const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
                const unitItems=selectedComp.unitItems.find(row=>row.unitId===unit.id)?.items||[];
                return <div className="comp-guide-unit" key={unit.id}>
                  <span className="comp-guide-portrait">{image&&<img src={image} alt=""/>}</span>
                  <div>
                    <strong>{unitName(unit.id,staticData)}</strong>
                    <small>presente em {Math.round(unit.rate)}%</small>
                    <div className="comp-guide-items">
                      {unitItems.length?unitItems.map(itemStat=>{
                        const itemEntry=staticEntry(staticData?.items,itemStat.id);
                        const src=staticData?tftAssetUrl(staticData.version,"item",itemEntry):"";
                        return <span title={itemName(itemStat.id,staticData)+" · "+Math.round(itemStat.rate)+"%"} key={itemStat.id}>
                          {src&&<img src={src} alt=""/>}
                        </span>;
                      }):<em>sem item recorrente</em>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
          </article>

          <article className="comp-guide-decision">
            <span>QUANDO CONSIDERAR</span>
            <strong>{hasProfile&&selectedComp.fit.score>=55
              ?"Seu histórico já tem sinais compatíveis com esta rota."
              :"Quando seu spot já estiver oferecendo várias peças e itens compatíveis."}</strong>
            <p>{hasProfile
              ?"Compatibilidade pessoal: "+selectedComp.fit.score+"/100 · "+selectedComp.fit.matchIds.length+" partidas relacionadas."
              :"Use a comp como referência de direção, não como compromisso antecipado."}</p>

            <span className="avoid">QUANDO NÃO FORÇAR</span>
            <strong>Quando você precisar sacrificar economia, upgrades naturais ou uma rota mais forte só para copiar o board final.</strong>
            <p>O dataset descreve como os boards terminaram. Ele não conhece toda a sequência de lojas e decisões que levou até lá.</p>

            <div className="comp-guide-buttons">
              {hasProfile&&selectedComp.fit.matchIds.length>0&&<button onClick={()=>onEvidence(
                selectedComp.fit.matchIds,
                "Comp Guide · "+compName(selectedComp,staticData),
              )}>Comparar com minhas partidas</button>}
              {onOpenBuilder&&<button className="secondary" onClick={()=>onOpenBuilder(selectedComp.units.slice(0,8).map(unit=>unit.id))}>
                Testar no Builder
              </button>}
            </div>
          </article>
        </div>
      </section>}

      <section className="comp-signal-grid">
        <article className="panel">
          <span>MAIS ESTÁVEL</span>
          <h3>{mostStable?compName(mostStable,staticData):"Sem sinal"}</h3>
          <p>{mostStable?"Variação "+mostStable.volatility+" · média "+mostStable.averagePlacement+" · "+mostStable.games+" jogos":"Aguardando amostra."}</p>
        </article>
        <article className="panel">
          <span>MAIS POPULAR</span>
          <h3>{mostPopular?compName(mostPopular,staticData):"Sem sinal"}</h3>
          <p>{mostPopular?mostPopular.games+" jogos · Top 4 "+mostPopular.top4Rate+"%":"Aguardando amostra."}</p>
        </article>
        <article className="panel">
          <span>SINAL EMERGENTE</span>
          <h3>{emerging?compName(emerging,staticData):"Ainda não disponível"}</h3>
          <p>{emerging?emerging.games+" jogos · média "+emerging.averagePlacement+" · confiança "+emerging.confidence:"Nenhuma amostra pequena se destacou ainda."}</p>
        </article>
      </section>

      <section className="panel comp-explorer">
        <div className="meta-explorer-head">
          <div><span>EXPLORAR</span><h2>{hasProfile?"Ordenado para o seu histórico":"Boards observados"}</h2></div>
          <small>{hasProfile?"compatibilidade + desempenho + amostra":"desempenho + amostra"}</small>
        </div>

        <div className="comp-list">
          {ranked.map((comp,index)=>(
            <article className="comp-row" key={comp.id}>
              <div className="comp-rank">{index+1}</div>
              <div className="comp-row-main">
                <strong>{compName(comp,staticData)}</strong>
                <div className="trait-row">
                  {comp.traits.slice(0,3).map(trait=><span className="trait-chip" key={trait.id}>{traitName(trait.id,staticData)} {Math.round(trait.rate)}%</span>)}
                </div>
              </div>
              <div className="comp-row-metrics">
                <span><small>Média</small><b>{comp.averagePlacement}</b></span>
                <span><small>Top 4</small><b>{comp.top4Rate}%</b></span>
                <span><small>Jogos</small><b>{comp.games}</b></span>
                {hasProfile&&<span className="fit"><small>Fit</small><b>{comp.fit.score}</b></span>}
              </div>
              <div className="comp-row-actions">
                <div className={"meta-confidence "+(comp.confidence==="alta"?"high":comp.confidence==="média"?"medium":"low")}>{comp.confidence}</div>
                <button onClick={()=>setSelectedCompId(comp.id)}>Detalhes</button>
              </div>
            </article>
          ))}
        </div>

        {!ranked.length&&<div className="meta-page-state">Ainda não há comps suficientes nesse contexto.</div>}

        <p className="global-meta-disclaimer">As comps são agrupadas pelas traits principais observadas nos boards finais do Chibi Dataset. Isso não é uma tier list oficial e não captura quando ou por que o jogador pivotou.</p>
      </section>
    </>}
  </main>;
}
