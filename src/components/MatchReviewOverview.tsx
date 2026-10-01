import { useMemo } from "react";
import { TftMatch, TftMatchDetail, TftUnit } from "../api/tft";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  target:TftMatch;
  detail:TftMatchDetail;
};

function copies(tier:number){
  return tier>=3?9:tier===2?3:1;
}

function boardValue(units:TftUnit[]){
  return units.reduce((sum,unit)=>{
    const cost=Math.max(1,Math.min(5,(Number(unit.rarity)||0)+1));
    return sum+cost*copies(Math.max(1,Number(unit.tier)||1));
  },0);
}

function itemCount(units:TftUnit[]){
  return units.reduce((sum,unit)=>sum+(unit.itemNames?.length||0),0);
}

function upgradeScore(units:TftUnit[]){
  return units.reduce((sum,unit)=>{
    const tier=Math.max(1,Number(unit.tier)||1);
    return sum+(tier>=3?3:tier===2?1:0);
  },0);
}

function average(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

function stageLabel(lastRound?:number){
  const round=Number(lastRound)||0;
  if(round<=0)return "—";
  if(round<5)return "R"+round;
  const offset=round-5;
  return (2+Math.floor(offset/7))+"-"+(1+(offset%7));
}

export default function MatchReviewOverview({target,detail}:Props){
  const review=useMemo(()=>{
    const lobby=detail.match.participants||[];
    const me=lobby.find(row=>row.placement===target.placement)||target;
    const top4=lobby.filter(row=>row.placement<=4);
    const referencePlacement=target.placement===1?2:Math.max(1,target.placement-1);
    const reference=lobby.find(row=>row.placement===referencePlacement)||null;

    const ownItems=itemCount(me.units);
    const ownUpgrades=upgradeScore(me.units);
    const ownBoard=boardValue(me.units);
    const ownThreeStars=me.units.filter(unit=>unit.tier>=3).length;

    const top4Items=average(top4.map(row=>itemCount(row.units)));
    const top4Upgrades=average(top4.map(row=>upgradeScore(row.units)));
    const top4Level=average(top4.map(row=>row.level));
    const top4Board=average(top4.map(row=>boardValue(row.units)));

    const facts:Array<{label:string;value:string;note:string;tone:"good"|"warning"|"neutral"}>=[];
    facts.push({
      label:"Resultado",
      value:target.placement+"º",
      note:target.placement<=4?"Top 4":"fora do Top 4",
      tone:target.placement<=4?"good":target.placement>=7?"warning":"neutral",
    });

    facts.push({
      label:"Board estimado",
      value:ownBoard+"g",
      note:top4Board==null?"sem referência":("Top 4 ~"+top4Board.toFixed(1)+"g"),
      tone:top4Board!=null&&ownBoard+4<top4Board?"warning":"neutral",
    });

    facts.push({
      label:"Itens equipados",
      value:String(ownItems),
      note:top4Items==null?"sem referência":("Top 4 ~"+top4Items.toFixed(1)),
      tone:top4Items!=null&&ownItems+1.5<top4Items?"warning":"neutral",
    });

    facts.push({
      label:"Upgrades",
      value:ownUpgrades+" pts",
      note:ownThreeStars+" unidade(s) 3★",
      tone:ownThreeStars>0?"good":"neutral",
    });

    let priorityTitle="Compare o snapshot final com a colocação imediatamente acima.";
    let priorityBody="Use diferenças observáveis de nível, upgrades, itens e valor estimado do board antes de tirar uma conclusão sobre a partida.";

    if(target.placement>=5&&target.goldLeft>=10){
      priorityTitle="Comece pelo ouro que sobrou no snapshot final.";
      priorityBody="Você terminou fora do Top 4 com "+target.goldLeft+"g. Isso não prova erro de economia, mas torna esta partida uma boa candidata para revisar se havia uma conversão plausível de recurso em força.";
    }else if(target.placement>=5&&top4Items!=null&&ownItems+1.5<top4Items){
      priorityTitle="Compare a densidade de itens com os boards de Top 4.";
      priorityBody="Seu snapshot terminou com "+ownItems+" itens equipados contra média aproximada de "+top4Items.toFixed(1)+" nos boards de Top 4 desta lobby.";
    }else if(target.placement>=5&&top4Upgrades!=null&&ownUpgrades+1<top4Upgrades){
      priorityTitle="Revise a densidade de upgrades do board final.";
      priorityBody="Seu board terminou com menos upgrades no snapshot do que a média observada entre os Top 4 desta lobby.";
    }else if(target.placement>=5&&top4Level!=null&&target.level+.5<top4Level){
      priorityTitle="Compare seu nível final com a pressão do Top 4.";
      priorityBody="Seu nível final ficou abaixo da média dos boards que chegaram ao Top 4. Use isso como ponto de investigação, não como causa isolada.";
    }else if(target.placement===1){
      priorityTitle="Salve este board como referência de conversão.";
      priorityBody="A vitória é útil como comparação futura: observe quais upgrades, itens, traits e nível estavam presentes quando o resultado foi convertido.";
    }else if(target.placement<=4){
      priorityTitle="Investigue o gap entre Top 4 e vitória.";
      priorityBody="A partida já converteu em Top 4. Compare seu snapshot com quem terminou acima para localizar diferenças observáveis sem assumir causalidade.";
    }

    const referenceSummary=reference?{
      placement:reference.placement,
      level:reference.level,
      gold:reference.goldLeft,
      board:boardValue(reference.units),
      items:itemCount(reference.units),
      upgrades:upgradeScore(reference.units),
    }:null;

    return {
      facts,
      priorityTitle,
      priorityBody,
      referenceSummary,
      stage:stageLabel(target.lastRound),
      sourceCache:detail.source?.cache||"miss",
    };
  },[target,detail]);

  return <section className="match-review-overview match-stage-with-art">
    <AdaptiveArtwork className="match-stage-art match-stage-art-economy" src={SITE_IMAGES.ui.economy} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
    <div className="match-review-overview-head">
      <div>
        <span>CHIBI MATCH REVIEW 2.0</span>
        <h3>O que vale revisar primeiro</h3>
        <p>Leitura pós-jogo baseada apenas no snapshot final retornado pela Riot.</p>
      </div>
      <div className={"match-cache-badge "+review.sourceCache}>
        <span>{review.sourceCache==="hit"?"CACHE":"RIOT"}</span>
        <small>{review.sourceCache==="hit"?"detalhe reaproveitado":"detalhe consultado"}</small>
      </div>
    </div>

    <div className="match-review-priority">
      <span>PRIORIDADE DE REVISÃO</span>
      <strong>{review.priorityTitle}</strong>
      <p>{review.priorityBody}</p>
    </div>

    <div className="match-review-facts">
      {review.facts.map(fact=>(
        <article className={fact.tone} key={fact.label}>
          <span>{fact.label}</span>
          <strong>{fact.value}</strong>
          <small>{fact.note}</small>
        </article>
      ))}
      <article>
        <span>Stage final</span>
        <strong>{review.stage}</strong>
        <small>derivado do round final</small>
      </article>
    </div>

    {review.referenceSummary&&<div className="match-review-reference">
      <div>
        <span>VOCÊ</span>
        <strong>{target.placement}º · Nv {target.level} · {target.goldLeft}g</strong>
      </div>
      <i>↔</i>
      <div>
        <span>{review.referenceSummary.placement}º LUGAR</span>
        <strong>Nv {review.referenceSummary.level} · {review.referenceSummary.gold}g · {review.referenceSummary.items} itens · {review.referenceSummary.upgrades} upg</strong>
      </div>
    </div>}

    <small className="match-review-limit">Sem timeline de shop, HP por rodada ou posicionamento histórico: o Chibi não inventa esses dados.</small>
  </section>;
}
