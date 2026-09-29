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

type ExploreMode="familiarity"|"confidence"|"stability"|"popularity";
type ConfidenceFilter="all"|"medium"|"high";

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

function confidenceRank(value:TftGlobalComp["confidence"]){
  return value==="alta"?3:value==="média"?2:1;
}

function coreTraits(comp:TftGlobalComp){
  const strong=comp.traits.filter(row=>row.rate>=55).slice(0,3);
  return strong.length?strong:comp.traits.slice(0,2);
}

function coreUnits(comp:TftGlobalComp){
  const strong=comp.units.filter(row=>row.rate>=45).slice(0,5);
  return strong.length>=3?strong:comp.units.slice(0,5);
}

function median(values:number[]){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
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
  const [exploreMode,setExploreMode]=useState<ExploreMode>(hasProfile?"familiarity":"popularity");
  const [confidenceFilter,setConfidenceFilter]=useState<ConfidenceFilter>("all");

  useEffect(()=>{
    if(!hasProfile&&exploreMode==="familiarity")setExploreMode("popularity");
  },[hasProfile,exploreMode]);

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

  const enriched=useMemo(()=>{
    return (data?.comps||[]).map(comp=>({
      ...comp,
      fit:personalFit(comp,matches),
    }));
  },[data,matches]);

  const stabilityCutoff=useMemo(
    ()=>median(enriched.map(comp=>comp.volatility).filter(value=>value>0)),
    [enriched]
  );

  const popularityCutoff=useMemo(
    ()=>median(enriched.map(comp=>comp.games).filter(value=>value>0)),
    [enriched]
  );

  const explored=useMemo(()=>{
    let rows=enriched.filter(comp=>{
      if(confidenceFilter==="high")return comp.confidence==="alta";
      if(confidenceFilter==="medium")return comp.confidence==="alta"||comp.confidence==="média";
      return true;
    });

    rows=[...rows].sort((a,b)=>{
      if(exploreMode==="familiarity"){
        return b.fit.score-a.fit.score
          ||b.fit.matchIds.length-a.fit.matchIds.length
          ||confidenceRank(b.confidence)-confidenceRank(a.confidence)
          ||b.games-a.games;
      }
      if(exploreMode==="confidence"){
        return confidenceRank(b.confidence)-confidenceRank(a.confidence)
          ||b.games-a.games
          ||a.averagePlacement-b.averagePlacement;
      }
      if(exploreMode==="stability"){
        return a.volatility-b.volatility
          ||confidenceRank(b.confidence)-confidenceRank(a.confidence)
          ||b.games-a.games;
      }
      return b.games-a.games
        ||confidenceRank(b.confidence)-confidenceRank(a.confidence)
        ||a.averagePlacement-b.averagePlacement;
    });

    return rows;
  },[enriched,exploreMode,confidenceFilter]);

  const mostFamiliar=useMemo(
    ()=>hasProfile
      ?[...enriched].sort((a,b)=>b.fit.score-a.fit.score||b.fit.matchIds.length-a.fit.matchIds.length||b.games-a.games)[0]||null
      :null,
    [enriched,hasProfile]
  );

  const mostStable=useMemo(
    ()=>enriched.slice().sort((a,b)=>a.volatility-b.volatility||b.games-a.games)[0]||null,
    [enriched]
  );

  const mostPopular=useMemo(
    ()=>enriched.slice().sort((a,b)=>b.games-a.games)[0]||null,
    [enriched]
  );

  const emerging=useMemo(
    ()=>enriched.filter(comp=>comp.games>=3&&comp.games<20)
      .sort((a,b)=>a.averagePlacement-b.averagePlacement||b.top4Rate-a.top4Rate)[0]||null,
    [enriched]
  );

  const hero=mostFamiliar||mostPopular;
  const selectedComp=enriched.find(comp=>comp.id===selectedCompId)||hero||enriched[0]||null;
  const maturity=data
    ? data.sampleParticipants>=1000?"robusta"
      : data.sampleParticipants>=250?"crescendo"
      : "inicial"
    : "inicial";

  function saveCompToShelf(comp:typeof enriched[number]){
    saveStudyShelfItem({
      type:"comp",
      label:compName(comp,staticData),
      subtitle:comp.games+" jogos · média "+comp.averagePlacement+" · Top 4 "+comp.top4Rate+"%",
      unitIds:comp.units.slice(0,8).map(unit=>unit.id),
    });
    setShelfSavedId(comp.id);
  }

  function familiarityCopy(comp:typeof enriched[number]){
    if(!hasProfile)return "Sem perfil aberto: mostrando somente sinais do Chibi Dataset.";
    if(!matches.length)return "Ainda não há histórico suficiente para medir familiaridade pessoal.";
    if(comp.fit.score>=60){
      return "Seu histórico já repete várias traits e unidades desta identidade.";
    }
    if(comp.fit.score>=30){
      return "Há alguma sobreposição com seu histórico, mas ainda não é uma rota muito recorrente para você.";
    }
    return "Esta rota quase não aparece no seu histórico recente.";
  }

  function spotCopy(comp:typeof enriched[number]){
    const traits=coreTraits(comp).slice(0,2).map(row=>traitName(row.id,staticData));
    const units=coreUnits(comp).slice(0,3).map(row=>unitName(row.id,staticData));
    const traitText=traits.filter(Boolean).join(" + ");
    const unitText=units.filter(Boolean).join(", ");

    if(traitText&&unitText){
      return "Use esta rota como referência quando seu plano já estiver convergindo para "+traitText+" e várias peças recorrentes ("+unitText+") fizerem sentido no board que você está montando.";
    }
    if(traitText){
      return "Use esta rota como referência quando seu plano já estiver convergindo para "+traitText+".";
    }
    return "Use esta rota somente como referência de board final observado; o Chibi não conhece sua sequência de lojas.";
  }

  return <main className="comps-page comps-page-v2">
    <section className="comps-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI COMPS · DECISÃO DE SPOT</span>
        <h1>{hasProfile?"O que combina com seu histórico":"Comps com contexto"}<br/><em>sem transformar fit em tier.</em></h1>
        <p>{hasProfile
          ?"O Chibi separa duas perguntas: o que você já conhece e o que o dataset global observou. Familiaridade não significa que a comp é globalmente melhor."
          :"Veja identidades de board observadas com estabilidade, popularidade, confiança e peças recorrentes."}</p>
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
      {hero&&<section className="panel comp-answer-card comp-answer-card-v2">
        <div className="comp-answer-copy">
          <span>{hasProfile?"MAIS FAMILIAR NO SEU HISTÓRICO":"MAIS OBSERVADA"}</span>
          <h2>{compName(hero,staticData)}</h2>
          <p>{hasProfile?familiarityCopy(hero):hero.games+" boards observados nesta identidade."}</p>
          {data.sampleParticipants<250&&<div className="comp-sample-warning">
            Base pequena: trate como direção de estudo, não como ordem para forçar.
          </div>}

          <div className="comp-answer-actions">
            {hasProfile&&hero.fit.matchIds.length>0&&<button onClick={()=>onEvidence(hero.fit.matchIds,"Familiaridade · "+compName(hero,staticData))}>Ver partidas relacionadas</button>}
            {onOpenBuilder&&<button className="secondary" onClick={()=>onOpenBuilder(hero.units.slice(0,8).map(unit=>unit.id))}>Abrir no Builder</button>}
          </div>
        </div>

        <div className="comp-answer-metrics comp-answer-metrics-v2">
          {hasProfile&&<div className="fit"><span>Familiaridade</span><strong>{hero.fit.score}</strong><small>{hero.fit.matchIds.length} partidas relacionadas</small></div>}
          <div><span>Amostra global</span><strong>{hero.games}</strong><small>boards observados</small></div>
          <div><span>Média</span><strong>{hero.averagePlacement}</strong><small>snapshot final</small></div>
          <div><span>Confiança</span><strong className="textual">{hero.confidence}</strong><small>pela amostra</small></div>
        </div>

        <div className="comp-core-units">
          {hero.units.slice(0,8).map(unit=>{
            const entry=staticEntry(staticData?.champions,unit.id);
            const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
            return <div title={unitName(unit.id,staticData)} key={unit.id}>
              {image&&<img src={image} alt={unitName(unit.id,staticData)} loading="lazy" decoding="async"/>}
              <span>{Math.round(unit.rate)}%</span>
            </div>;
          })}
        </div>

        <div className="comp-guardrail">
          <strong>Familiaridade ≠ força global.</strong>
          <span>Seu histórico mede recorrência pessoal. O dataset global mede apenas os boards observados pelo Chibi.</span>
        </div>
      </section>}

      {selectedComp&&<section className="panel comp-guide-panel comp-guide-panel-v2">
        <div className="comp-guide-head">
          <div>
            <span>COMP GUIDE · OBSERVADO</span>
            <h2>{compName(selectedComp,staticData)}</h2>
            <p>Resposta primeiro: quais sinais tornam esta rota plausível, o que você já conhece e o que a amostra global realmente mostra.</p>
          </div>
          <div className="comp-guide-context">
            <span>Nível médio</span><strong>{selectedComp.averageLevel}</strong>
            <span>Ouro final</span><strong>{selectedComp.averageGold}g</strong>
            <button className="comp-shelf-button" onClick={()=>saveCompToShelf(selectedComp)}>
              {shelfSavedId===selectedComp.id?"Salvo no Shelf ✓":"Salvar no Study Shelf"}
            </button>
          </div>
        </div>

        <div className="comp-split-evidence">
          {hasProfile&&<article className="personal">
            <span>SEU HISTÓRICO</span>
            <strong>{selectedComp.fit.score}/100 familiaridade</strong>
            <p>{familiarityCopy(selectedComp)}</p>
            <div>
              <small>Traits conhecidas <b>{selectedComp.fit.traitOverlap}%</b></small>
              <small>Unidades conhecidas <b>{selectedComp.fit.unitOverlap}%</b></small>
              <small>Partidas relacionadas <b>{selectedComp.fit.matchIds.length}</b></small>
            </div>
          </article>}

          <article className="global">
            <span>AMOSTRA GLOBAL</span>
            <strong>{selectedComp.games} boards · confiança {selectedComp.confidence}</strong>
            <p>Média {selectedComp.averagePlacement} · Top 4 {selectedComp.top4Rate}% · volatilidade {selectedComp.volatility}.</p>
            <small>Isso descreve a amostra observada; não é tier oficial nem previsão de resultado.</small>
          </article>
        </div>

        <div className="comp-guide-grid">
          <article>
            <span>PEÇAS QUE DEFINEM A ROTA</span>

            <div className="comp-spot-signals">
              <div>
                <small>TRAITS CENTRAIS</small>
                <div>
                  {coreTraits(selectedComp).map(trait=>(
                    <span className="trait" key={trait.id}>
                      {traitName(trait.id,staticData)}
                      <b>{Math.round(trait.rate)}%</b>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <small>UNIDADES RECORRENTES</small>
                <div>
                  {coreUnits(selectedComp).map(unit=>(
                    <span className="unit" key={unit.id}>
                      {unitName(unit.id,staticData)}
                      <b>{Math.round(unit.rate)}%</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="comp-guide-units">
              {selectedComp.units.slice(0,8).map(unit=>{
                const entry=staticEntry(staticData?.champions,unit.id);
                const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
                const unitItems=selectedComp.unitItems.find(row=>row.unitId===unit.id)?.items||[];
                return <div className="comp-guide-unit" key={unit.id}>
                  <span className="comp-guide-portrait">{image&&<img src={image} alt="" loading="lazy" decoding="async"/>}</span>
                  <div>
                    <strong>{unitName(unit.id,staticData)}</strong>
                    <small>presente em {Math.round(unit.rate)}%</small>
                    <div className="comp-guide-items">
                      {unitItems.length?unitItems.map(itemStat=>{
                        const itemEntry=staticEntry(staticData?.items,itemStat.id);
                        const src=staticData?tftAssetUrl(staticData.version,"item",itemEntry):"";
                        return <span title={itemName(itemStat.id,staticData)+" · "+Math.round(itemStat.rate)+"%"} key={itemStat.id}>
                          {src&&<img src={src} alt="" loading="lazy" decoding="async"/>}
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
            <strong>{spotCopy(selectedComp)}</strong>
            <p>{hasProfile
              ? "Seu histórico é usado só para medir familiaridade; a recomendação não mistura isso com desempenho global."
              : "Sem perfil aberto, o Chibi mostra apenas sinais observados da identidade."}</p>

            <span className="avoid">QUANDO NÃO FORÇAR</span>
            <strong>Quando copiar o board final exigir abandonar upgrades naturais, economia ou uma rota que já está funcionando melhor.</strong>
            <p>O dataset não conhece sua sequência de shops, timing de roll, HP por round ou scouting. Ele só vê o snapshot final.</p>

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
          <p>{mostStable
            ?"Volatilidade "+mostStable.volatility+" · "+mostStable.games+" jogos · confiança "+mostStable.confidence
            :"Aguardando amostra."}</p>
        </article>
        <article className="panel">
          <span>MAIS OBSERVADA</span>
          <h3>{mostPopular?compName(mostPopular,staticData):"Sem sinal"}</h3>
          <p>{mostPopular?mostPopular.games+" boards · média "+mostPopular.averagePlacement+" · confiança "+mostPopular.confidence:"Aguardando amostra."}</p>
        </article>
        <article className="panel">
          <span>SINAL EMERGENTE</span>
          <h3>{emerging?compName(emerging,staticData):"Ainda não disponível"}</h3>
          <p>{emerging?emerging.games+" jogos · média "+emerging.averagePlacement+" · confiança "+emerging.confidence:"Nenhuma amostra pequena se destacou ainda."}</p>
        </article>
      </section>

      <section className="panel comp-explorer comp-explorer-v2">
        <div className="meta-explorer-head">
          <div>
            <span>EXPLORAR</span>
            <h2>{hasProfile?"Escolha a lente certa":"Compare os sinais observados"}</h2>
          </div>
          <small>{explored.length} identidades neste recorte</small>
        </div>

        <div className="comp-explore-controls">
          <div className="comp-mode-tabs">
            {hasProfile&&<button className={exploreMode==="familiarity"?"active":""} onClick={()=>setExploreMode("familiarity")}>Familiaridade</button>}
            <button className={exploreMode==="confidence"?"active":""} onClick={()=>setExploreMode("confidence")}>Confiança</button>
            <button className={exploreMode==="stability"?"active":""} onClick={()=>setExploreMode("stability")}>
              Estabilidade
              {stabilityCutoff>0&&<small>≤ {stabilityCutoff.toFixed(2)}</small>}
            </button>
            <button className={exploreMode==="popularity"?"active":""} onClick={()=>setExploreMode("popularity")}>
              Popularidade
              {popularityCutoff>0&&<small>mediana {Math.round(popularityCutoff)}</small>}
            </button>
          </div>

          <div className="comp-confidence-filter">
            <span>Amostra</span>
            <button className={confidenceFilter==="all"?"active":""} onClick={()=>setConfidenceFilter("all")}>Todas</button>
            <button className={confidenceFilter==="medium"?"active":""} onClick={()=>setConfidenceFilter("medium")}>Média+</button>
            <button className={confidenceFilter==="high"?"active":""} onClick={()=>setConfidenceFilter("high")}>Alta</button>
          </div>
        </div>

        <div className="comp-list">
          {explored.map((comp,index)=>(
            <article className={"comp-row "+(selectedComp?.id===comp.id?"selected":"")} key={comp.id}>
              <div className="comp-rank">{index+1}</div>
              <div className="comp-row-main">
                <strong>{compName(comp,staticData)}</strong>
                <div className="trait-row">
                  {comp.traits.slice(0,3).map(trait=><span className="trait-chip" key={trait.id}>{traitName(trait.id,staticData)} {Math.round(trait.rate)}%</span>)}
                </div>
              </div>

              <div className="comp-row-metrics">
                {hasProfile&&<span className="fit"><small>Familiaridade</small><b>{comp.fit.score}</b></span>}
                <span><small>Média</small><b>{comp.averagePlacement}</b></span>
                <span><small>Jogos</small><b>{comp.games}</b></span>
                <span><small>Volatilidade</small><b>{comp.volatility}</b></span>
              </div>

              <div className="comp-row-actions">
                <div className={"meta-confidence "+(comp.confidence==="alta"?"high":comp.confidence==="média"?"medium":"low")}>{comp.confidence}</div>
                <button onClick={()=>setSelectedCompId(comp.id)}>Detalhes</button>
              </div>
            </article>
          ))}
        </div>

        {!explored.length&&<div className="meta-page-state">
          Nenhuma comp atende esse filtro de confiança. Tente ampliar a amostra.
        </div>}

        <p className="global-meta-disclaimer">
          As comps são agrupadas pelas traits principais observadas nos boards finais do Chibi Dataset. Familiaridade pessoal, estabilidade e popularidade são lentes separadas — nenhuma delas transforma o board em tier oficial.
        </p>
      </section>
    </>}
  </main>;
}
