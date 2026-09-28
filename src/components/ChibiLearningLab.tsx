import { useEffect, useMemo, useState } from "react";
import { fetchTftComps, TftGlobalComps, TftMatch, TftUnit } from "../api/tft";
import { buildChibiDNA } from "../analysis/chibiInsights";
import { buildLeakMap } from "../analysis/chibiProduct";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";

type Props={
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder?:(championIds:string[])=>void;
};

type LossSignal={
  id:string;
  title:string;
  body:string;
  evidence:string;
  strength:number;
};

type PackageRow={
  id:string;
  units:string[];
  games:TftMatch[];
  avgPlacement:number;
  top4Rate:number;
  variants:number;
  connectors:Array<{id:string;games:number}>;
  score:number;
  usageRate:number;
  flexScore:number;
  confidence:"alta"|"média"|"inicial";
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

function pct(n:number,d:number){
  return d?Math.round(n/d*100):0;
}

function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,value));
}

function cleanName(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\s{2,}/g," ")
    .trim();
}

function championName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||cleanName(id);
}

function unitCost(unit:TftUnit){
  const cost=Math.max(1,Math.min(5,Number(unit.rarity)+1));
  const copies=unit.tier>=3?9:unit.tier===2?3:1;
  return cost*copies;
}

function boardInvestment(match:TftMatch){
  return match.units.reduce((sum,unit)=>sum+unitCost(unit),0);
}

function itemCount(match:TftMatch){
  return match.units.reduce((sum,unit)=>sum+unit.itemNames.length,0);
}

function threeStars(match:TftMatch){
  return match.units.filter(unit=>unit.tier>=3).length;
}

function combinations<T>(values:T[],size:number){
  const out:T[][]=[];
  function walk(start:number,current:T[]){
    if(current.length===size){
      out.push(current.slice());
      return;
    }
    for(let index=start;index<values.length;index++){
      current.push(values[index]);
      walk(index+1,current);
      current.pop();
    }
  }
  walk(0,[]);
  return out;
}

function buildPackages(matches:TftMatch[]):PackageRow[]{
  const valid=matches.filter(match=>match.units.length>=2&&match.placement>=1&&match.placement<=8);
  if(!valid.length) return [];

  function collect(size:number){
    const map=new Map<string,{units:string[];games:TftMatch[]}>();

    for(const match of valid){
      const unitIds=[...new Set(match.units.map(unit=>unit.characterId).filter(Boolean))].sort();
      for(const group of combinations(unitIds,size)){
        const id=group.join("|");
        const row=map.get(id)||{units:group,games:[]};
        row.games.push(match);
        map.set(id,row);
      }
    }

    return [...map.entries()]
      .filter(([,row])=>row.games.length>=2)
      .map(([id,row])=>{
        const placements=row.games.map(match=>match.placement);
        const average=avg(placements)??8;
        const top4=row.games.filter(match=>match.placement<=4).length;
        const outsideSets=new Set<string>();
        const connectorCounts=new Map<string,number>();

        for(const match of row.games){
          const outside=[...new Set(
            match.units
              .map(unit=>unit.characterId)
              .filter(unitId=>unitId&&!row.units.includes(unitId))
          )].sort();

          outsideSets.add(outside.join("|"));
          outside.forEach(unitId=>connectorCounts.set(unitId,(connectorCounts.get(unitId)||0)+1));
        }

        const connectors=[...connectorCounts.entries()]
          .map(([unitId,games])=>({id:unitId,games}))
          .sort((a,b)=>b.games-a.games)
          .slice(0,3);

        const top4Rate=pct(top4,row.games.length);
        const usageRate=pct(row.games.length,valid.length);
        const flexScore=clamp(Math.round(
          Math.min(35,row.games.length*6)+
          Math.min(30,outsideSets.size*10)+
          top4Rate*.25
        ));
        const packageConfidence:"alta"|"média"|"inicial"=
          valid.length>=15&&row.games.length>=6&&outsideSets.size>=3
            ?"alta"
            :row.games.length>=3&&outsideSets.size>=2
              ?"média"
              :"inicial";
        const score=row.games.length*18+top4Rate*.45+(9-average)*5+Math.min(4,outsideSets.size)*5;

        return {
          id,
          units:row.units,
          games:row.games,
          avgPlacement:+average.toFixed(2),
          top4Rate,
          variants:outsideSets.size,
          connectors,
          score,
          usageRate,
          flexScore,
          confidence:packageConfidence,
        };
      })
      .sort((a,b)=>b.score-a.score||a.avgPlacement-b.avgPlacement)
      .slice(0,4);
  }

  const triples=collect(3);
  return triples.length?triples:collect(2);
}

function buildLossSignals(match:TftMatch,baseline:TftMatch[]):LossSignal[]{
  const signals:LossSignal[]=[];
  const baselineLevel=avg(baseline.map(game=>game.level));
  const baselineBoard=avg(baseline.map(boardInvestment));
  const baselineItems=avg(baseline.map(itemCount));
  const baselineStars=avg(baseline.map(threeStars));

  if(match.goldLeft>=10){
    const strength=clamp(52+(match.goldLeft-10)*2,52,92);
    signals.push({
      id:"gold",
      title:"Ouro não convertido no board final",
      body:"Você terminou fora do Top 4 com uma reserva relevante de ouro. Isso não prova que rolar seria correto antes, mas é um ponto concreto para revisar.",
      evidence:`${match.goldLeft}g restantes ao fim da partida`,
      strength,
    });
  }

  if(baselineLevel!=null&&match.level<=baselineLevel-.5){
    const delta=baselineLevel-match.level;
    signals.push({
      id:"level",
      title:"Seu nível final ficou abaixo do seu padrão de Top 4",
      body:"Nas suas melhores partidas recentes, você normalmente terminou em um nível mais alto. Vale revisar se faltou tempo, economia ou estabilização para chegar lá.",
      evidence:`Partida: nível ${match.level} · seus Top 4: ${baselineLevel.toFixed(1)}`,
      strength:clamp(48+delta*18,48,88),
    });
  }

  const investment=boardInvestment(match);
  if(baselineBoard!=null&&investment<=baselineBoard*.82){
    const gap=Math.round((1-investment/baselineBoard)*100);
    signals.push({
      id:"board",
      title:"Board final menos investido que seus Top 4",
      body:"O valor aproximado das estrelas e custos das unidades terminou abaixo do seu próprio padrão de Top 4. Use isso para procurar upgrades que não chegaram.",
      evidence:`Board estimado: ${investment}g · Top 4 pessoal: ${baselineBoard.toFixed(0)}g · gap ${gap}%`,
      strength:clamp(50+gap,50,90),
    });
  }

  const items=itemCount(match);
  if(baselineItems!=null&&items<=baselineItems-2){
    signals.push({
      id:"items",
      title:"Menos itens registrados no board final",
      body:"O board terminou com menos itens equipados que seu padrão de Top 4. O dado não revela bench ou componentes não equipados, então trate como pista e não como causa.",
      evidence:`Partida: ${items} itens · Top 4 pessoal: ${baselineItems.toFixed(1)}`,
      strength:58,
    });
  }

  const stars=threeStars(match);
  if(baselineStars!=null&&baselineStars>=.5&&stars<baselineStars-.4){
    signals.push({
      id:"stars",
      title:"Menos upgrades máximos que seu padrão vencedor",
      body:"Seus Top 4 recentes tiveram mais unidades 3★ em média. Isso pode indicar que esta linha precisava de upgrades que não chegaram.",
      evidence:`Partida: ${stars} unidade(s) 3★ · Top 4 pessoal: ${baselineStars.toFixed(1)}`,
      strength:55,
    });
  }

  if(!signals.length){
    signals.push({
      id:"unknown",
      title:"Nenhuma causa forte aparece só no board final",
      body:"Seu resultado não tem um sinal dominante nos dados disponíveis. Posicionamento por rodada, shop, HP e decisões de rolldown fariam diferença nesta análise.",
      evidence:"O Chibi prefere admitir incerteza a inventar uma explicação.",
      strength:35,
    });
  }

  return signals.sort((a,b)=>b.strength-a.strength).slice(0,3);
}

function confidenceLabel(sample:number,baseline:number,signals:LossSignal[]){
  const maxSignal=Math.max(0,...signals.map(signal=>signal.strength));
  if(sample>=20&&baseline>=6&&maxSignal>=65) return {label:"Alta",tone:"high",score:88};
  if(sample>=10&&baseline>=3&&maxSignal>=50) return {label:"Média",tone:"medium",score:68};
  return {label:"Inicial",tone:"low",score:42};
}

function focusPlan(matches:TftMatch[]){
  const dna=buildChibiDNA(matches);
  const leaks=buildLeakMap(matches);
  const primary=leaks.primary;

  if(primary?.id==="bottom2"||dna.bottom2Rate>=25){
    return {
      label:"Proteção de piso",
      title:"Aprenda a transformar 7º/8º em 4º–6º",
      body:"Seu maior ganho provável está em reduzir partidas que desabam. Revise primeiro boards finais dos Bottom 2 e procure o primeiro padrão repetido.",
      metric:`Bottom 2 atual: ${dna.bottom2Rate}%`,
      ids:matches.filter(match=>match.placement>=7).map(match=>match.id),
    };
  }

  if(primary?.id==="dominance"||dna.flexibility<45){
    return {
      label:"Flexibilidade",
      title:"Construa uma segunda saída para os mesmos itens",
      body:"Seu histórico está concentrado em poucas identidades. Use os Flex Packages abaixo para aprender núcleos e conectores, em vez de decorar um board de oito unidades.",
      metric:`Flexibilidade observada: ${dna.flexibility}%`,
      ids:primary?.matchIds||matches.map(match=>match.id),
    };
  }

  if(primary?.id==="conversion"||dna.conversion<25){
    return {
      label:"Conversão",
      title:"Aprenda a fechar partidas depois do Top 4",
      body:"Você já chega em boas posições; agora compare seus Top 4 que viraram vitória com os que pararam em 2º–4º e procure diferenças de nível, upgrades e itens.",
      metric:`Conversão Top 4 → 1º: ${dna.conversion}%`,
      ids:matches.filter(match=>match.placement<=4).map(match=>match.id),
    };
  }

  if(primary?.id==="level-conversion"){
    return {
      label:"Board cap",
      title:"Transforme nível em força real de board",
      body:"Subir nível não está separando suas melhores partidas das piores. Foque em como o ouro vira unidades, estrelas, traits e itens no board final.",
      metric:primary.evidence,
      ids:primary.matchIds,
    };
  }

  return {
    label:"Leitura de jogo",
    title:"Aprofunde as decisões que seus números ainda não explicam",
    body:"Seu histórico não mostra um vazamento dominante. Escolha uma partida apertada e registre o que aconteceu antes do board final para melhorar a próxima análise.",
    metric:`${matches.length} partidas no contexto`,
    ids:matches.slice(0,6).map(match=>match.id),
  };
}

function Champion({id,staticData}:{id:string;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.champions,id);
  const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
  const name=championName(id,staticData);

  return <span className="learning-champion" title={name}>
    <span>{name.slice(0,2)}</span>
    {image&&<img src={image} alt={name} onError={(event)=>{event.currentTarget.style.display="none";}}/>}
  </span>;
}

export default function ChibiLearningLab({matches,staticData,onEvidence,onOpenBuilder}:Props){
  const [globalComps,setGlobalComps]=useState<TftGlobalComps|null>(null);
  const [globalLoading,setGlobalLoading]=useState(false);
  const losses=useMemo(
    ()=>matches.filter(match=>match.placement>=5).slice(0,5),
    [matches],
  );
  const [selectedLossId,setSelectedLossId]=useState(losses[0]?.id||"");

  useEffect(()=>{
    if(!losses.some(match=>match.id===selectedLossId)){
      setSelectedLossId(losses[0]?.id||"");
    }
  },[losses,selectedLossId]);

  const selectedLoss=losses.find(match=>match.id===selectedLossId)||losses[0]||null;
  const top4=useMemo(()=>matches.filter(match=>match.placement<=4),[matches]);
  const baseline=top4.length>=2?top4:matches.filter(match=>match.id!==selectedLoss?.id).slice(0,8);
  const signals=useMemo(
    ()=>selectedLoss?buildLossSignals(selectedLoss,baseline):[],
    [selectedLoss,baseline],
  );
  const confidence=confidenceLabel(matches.length,top4.length,signals);
  const strongestSignal=Math.max(0,...signals.map(signal=>signal.strength));
  const confidenceReasons=[
    {label:"Amostra",value:matches.length+" jogos",good:matches.length>=10},
    {label:"Referência",value:top4.length+" Top 4",good:top4.length>=3},
    {label:"Sinal",value:strongestSignal+"%",good:strongestSignal>=50},
  ];
  const packages=useMemo(()=>buildPackages(matches),[matches]);
  const setNumber=useMemo(
    ()=>Number(matches.find(match=>Number(match.setNumber)>0)?.setNumber)||null,
    [matches],
  );
  const queueId=useMemo(()=>{
    const ids=[...new Set(matches.map(match=>Number(match.queueId)||0).filter(Boolean))];
    return ids.length===1?ids[0]:null;
  },[matches]);

  useEffect(()=>{
    let cancelled=false;
    if(!setNumber){
      setGlobalComps(null);
      return;
    }
    setGlobalLoading(true);
    fetchTftComps(setNumber,queueId,3,24)
      .then(data=>{if(!cancelled)setGlobalComps(data);})
      .catch(()=>{if(!cancelled)setGlobalComps(null);})
      .finally(()=>{if(!cancelled)setGlobalLoading(false);});
    return ()=>{cancelled=true;};
  },[setNumber,queueId]);

  const packageGlobalMatches=useMemo(()=>{
    const result=new Map<string,{
      comp:TftGlobalComps["comps"][number];
      overlap:number;
      coverage:number;
    }>();
    if(!globalComps)return result;

    for(const pack of packages){
      let best:null|{
        comp:TftGlobalComps["comps"][number];
        overlap:number;
        coverage:number;
        score:number;
      }=null;

      for(const comp of globalComps.comps){
        const globalUnits=new Set(
          comp.units
            .filter(unit=>unit.rate>=.3)
            .map(unit=>unit.id)
        );
        const overlap=pack.units.filter(unitId=>globalUnits.has(unitId)).length;
        const coverage=overlap/Math.max(1,pack.units.length);
        const score=coverage*100+Math.min(25,comp.games/4);
        if(overlap<2)continue;
        if(!best||score>best.score)best={comp,overlap,coverage,score};
      }

      if(best&&best.coverage>=.66){
        result.set(pack.id,{
          comp:best.comp,
          overlap:best.overlap,
          coverage:best.coverage,
        });
      }
    }
    return result;
  },[packages,globalComps]);

  const packageRoutes=useMemo(()=>{
    const routes:Array<{
      id:string;
      from:PackageRow;
      to:PackageRow;
      shared:string[];
      remove:string[];
      add:string[];
      score:number;
    }>=[];

    for(let left=0;left<packages.length;left++){
      for(let right=left+1;right<packages.length;right++){
        const from=packages[left];
        const to=packages[right];
        const shared=from.units.filter(id=>to.units.includes(id));
        if(!shared.length)continue;

        const remove=from.units.filter(id=>!to.units.includes(id));
        const add=to.units.filter(id=>!from.units.includes(id));
        const score=shared.length*30+Math.min(from.flexScore,to.flexScore);

        routes.push({
          id:from.id+"->"+to.id,
          from,
          to,
          shared,
          remove,
          add,
          score,
        });
      }
    }

    return routes.sort((a,b)=>b.score-a.score).slice(0,3);
  },[packages]);

  const focus=useMemo(()=>focusPlan(matches),[matches]);

  return <section className="learning-lab">
    <div className="learning-lab-title">
      <div>
        <span>CHIBI LEARNING LAB</span>
        <h2>Entenda a partida. Aprenda o padrão. Jogue melhor.</h2>
        <p>O Chibi transforma seu histórico em hipóteses testáveis, sem fingir que board final explica tudo.</p>
      </div>
      <div className={"learning-confidence "+confidence.tone}>
        <small>CONFIANÇA DOS DADOS</small>
        <strong>{confidence.label}</strong>
        <span>{confidence.score}%</span>
        <div className="confidence-reasons">
          {confidenceReasons.map(reason=>(
            <i className={reason.good?"ready":""} key={reason.label}>
              <b>{reason.label}</b>
              <em>{reason.value}</em>
            </i>
          ))}
        </div>
      </div>
    </div>

    <div className="learning-primary-grid">
      <article className="panel why-loss-card">
        <header>
          <div>
            <span>POR QUE EU PERDI?</span>
            <h3>{selectedLoss?selectedLoss.placement+"º lugar · sinais observáveis":"Sem derrota recente no contexto"}</h3>
          </div>
          {selectedLoss&&<button onClick={()=>onEvidence([selectedLoss.id],"Why Did I Lose · partida analisada")}>Abrir partida</button>}
        </header>

        {losses.length>1&&<div className="loss-selector" aria-label="Escolher partida para análise">
          {losses.map(match=>(
            <button
              className={match.id===selectedLoss?.id?"active":""}
              onClick={()=>setSelectedLossId(match.id)}
              key={match.id}
            >
              <b>{match.placement}º</b>
              <small>{match.level} lvl · {match.goldLeft}g</small>
            </button>
          ))}
        </div>}

        {selectedLoss?(
          <>
            <div className="loss-signal-list">
              {signals.map((signal,index)=>(
                <div className="loss-signal" key={signal.id}>
                  <span className="loss-signal-rank">{index+1}</span>
                  <div>
                    <div className="loss-signal-title">
                      <strong>{signal.title}</strong>
                      <em>{signal.strength}% sinal</em>
                    </div>
                    <p>{signal.body}</p>
                    <small>{signal.evidence}</small>
                  </div>
                </div>
              ))}
            </div>
            <footer>
              <span>Comparação pessoal</span>
              <p>Baseline: {baseline.length} partida(s), priorizando seus Top 4. Os sinais mostram <b>onde revisar</b>; não afirmam causalidade.</p>
            </footer>
          </>
        ):(
          <div className="learning-empty">Nenhuma partida fora do Top 4 foi carregada neste contexto.</div>
        )}
      </article>

      <article className="panel learn-next-card">
        <span>O QUE DEVO APRENDER AGORA?</span>
        <div className="learn-next-badge">{focus.label}</div>
        <h3>{focus.title}</h3>
        <p>{focus.body}</p>
        <div className="learn-next-metric">
          <small>SINAL ATUAL</small>
          <strong>{focus.metric}</strong>
        </div>
        {focus.ids.length>0&&<button onClick={()=>onEvidence(focus.ids,"Learning Lab · "+focus.label)}>Estudar partidas relacionadas</button>}
        <div className="learning-rule">
          <b>Regra Chibi</b>
          <span>Uma habilidade por vez. Uma hipótese por sessão. Evidência antes de conselho.</span>
        </div>
      </article>
    </div>

    <article className="panel flex-packages-card">
      <header>
        <div>
          <span>FLEX PACKAGES</span>
          <h3>Pare de decorar 8 unidades. Aprenda os núcleos que você já usa.</h3>
          <p>Pacotes recorrentes detectados no seu histórico e os campeões que mais aparecem conectando cada núcleo.</p>
        </div>
        <small>{packages.length} packages encontrados</small>
      </header>

      {packages.length?(
        <div className="flex-package-grid">
          {packages.slice(0,3).map((pack,index)=>(
            <article className="flex-package" key={pack.id}>
              <div className="flex-package-top">
                <span>PACKAGE {String(index+1).padStart(2,"0")}</span>
                <div className="flex-package-badges">
                  <em>{pack.variants} variação{pack.variants===1?"":"ões"}</em>
                  <b className={"package-confidence "+pack.confidence}>{pack.confidence}</b>
                </div>
              </div>
              <div className="flex-core">
                {pack.units.map(unitId=><Champion id={unitId} staticData={staticData} key={unitId}/>)}
              </div>
              <strong className="flex-package-names">{pack.units.map(id=>championName(id,staticData)).join(" + ")}</strong>
              <div className="flex-package-stats">
                <span><small>Jogos</small><b>{pack.games.length}</b></span>
                <span><small>Uso</small><b>{pack.usageRate}%</b></span>
                <span><small>Top 4</small><b>{pack.top4Rate}%</b></span>
                <span><small>Flex</small><b>{pack.flexScore}</b></span>
              </div>

              {(()=>{
                const global=packageGlobalMatches.get(pack.id);
                return <div className={"flex-global-signal "+(global?"matched":"")}>
                  <small>BOARD GLOBAL MAIS PARECIDO</small>
                  {global?(
                    <>
                      <strong>{Math.round(global.coverage*100)}% do core encontrado</strong>
                      <span>{global.comp.games} jogos · média {global.comp.averagePlacement} · Top 4 {global.comp.top4Rate}% · confiança {global.comp.confidence}</span>
                    </>
                  ):(
                    <span>{globalLoading?"Comparando com o Chibi Dataset...":"Sem paralelo global confiável nesta amostra."}</span>
                  )}
                </div>;
              })()}

              <div className="flex-connectors">
                <small>CONECTORES MAIS USADOS</small>
                {pack.connectors.length?(
                  <div>
                    {pack.connectors.map(connector=>(
                      <span key={connector.id}>
                        <Champion id={connector.id} staticData={staticData}/>
                        <b>{championName(connector.id,staticData)}</b>
                        <em>{connector.games}x</em>
                      </span>
                    ))}
                  </div>
                ):<p>Sem conectores recorrentes suficientes.</p>}
              </div>

              <div className="flex-package-actions">
                <button onClick={()=>onEvidence(pack.games.map(game=>game.id),"Flex Package · "+pack.units.map(id=>championName(id,staticData)).join(" + "))}>
                  Ver evidências
                </button>
                {onOpenBuilder&&<button className="primary" onClick={()=>onOpenBuilder(pack.units)}>
                  Testar no Builder
                </button>}
              </div>
            </article>
          ))}
        </div>
      ):(
        <div className="learning-empty">
          Carregue mais partidas para o Chibi detectar núcleos repetidos. Packages só aparecem depois de pelo menos duas ocorrências.
        </div>
      )}

      {packageRoutes.length>0&&<div className="flex-routes">
        <div className="flex-routes-head">
          <div>
            <span>FLEX ROUTES</span>
            <strong>Como sair de um core para outro sem reconstruir tudo</strong>
          </div>
          <small>{packageRoutes.length} rota{packageRoutes.length===1?"":"s"}</small>
        </div>

        <div className="flex-route-list">
          {packageRoutes.map(route=>(
            <article key={route.id}>
              <div className="flex-route-core">
                <div>
                  <small>CORE A</small>
                  <strong>{route.from.units.map(id=>championName(id,staticData)).join(" + ")}</strong>
                </div>
                <span>→</span>
                <div>
                  <small>CORE B</small>
                  <strong>{route.to.units.map(id=>championName(id,staticData)).join(" + ")}</strong>
                </div>
              </div>

              <div className="flex-route-changes">
                <span className="keep"><b>MANTÉM</b>{route.shared.map(id=>championName(id,staticData)).join(", ")}</span>
                {route.remove.length>0&&<span className="remove"><b>SAI</b>{route.remove.map(id=>championName(id,staticData)).join(", ")}</span>}
                {route.add.length>0&&<span className="add"><b>ENTRA</b>{route.add.map(id=>championName(id,staticData)).join(", ")}</span>}
              </div>

              {onOpenBuilder&&<button onClick={()=>onOpenBuilder(route.to.units)}>Abrir destino no Builder</button>}
            </article>
          ))}
        </div>
      </div>}

      <footer className="flex-package-method">
        <b>Como funciona nesta versão</b>
        <span>O Chibi encontra campeões que reaparecem juntos, mede frequência, resultado e quantas variações existiram ao redor do núcleo. A confiança do package indica recorrência na sua própria amostra — não força global nem probabilidade de vitória. Quando existe um board global suficientemente parecido, ele aparece separadamente como contexto do Chibi Dataset.</span>
      </footer>
    </article>
  </section>;
}
