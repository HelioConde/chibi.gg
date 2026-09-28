import { useMemo } from "react";
import { TftMatch, TftMatchDetail, TftUnit } from "../api/tft";

type Props={
  target:TftMatch;
  detail:TftMatchDetail;
};

type Metric={
  id:string;
  label:string;
  value:string;
  rank:number;
  total:number;
  score:number;
  help:string;
};

function copies(tier:number){
  return tier>=3?9:tier===2?3:1;
}

function cost(unit:TftUnit){
  return Math.max(1,Math.min(5,(Number(unit.rarity)||0)+1));
}

function boardValue(units:TftUnit[]){
  return units.reduce(
    (sum,unit)=>sum+cost(unit)*copies(Math.max(1,Number(unit.tier)||1)),
    0,
  );
}

function upgradeScore(units:TftUnit[]){
  return units.reduce((sum,unit)=>{
    const tier=Math.max(1,Number(unit.tier)||1);
    return sum+(tier===1?0:tier===2?1:3);
  },0);
}

function itemCount(units:TftUnit[]){
  return units.reduce((sum,unit)=>sum+(unit.itemNames?.length||0),0);
}

function rankMetric(values:number[],mine:number){
  const greater=values.filter(value=>value>mine).length;
  const rank=greater+1;
  const total=values.length;
  const score=total<=1?100:Math.round((1-(rank-1)/(total-1))*100);
  return {rank,total,score};
}

function labelForScore(score:number){
  if(score>=85)return "Topo da lobby";
  if(score>=60)return "Acima da média";
  if(score>=35)return "Meio da lobby";
  return "Abaixo da lobby";
}

export default function MatchScorecard({target,detail}:Props){
  const data=useMemo(()=>{
    const participants=detail.match.participants;
    const you=participants.find(participant=>participant.placement===target.placement);
    if(!you||participants.length<2)return null;

    const rows=participants.map(participant=>({
      placement:participant.placement,
      board:boardValue(participant.units),
      upgrades:upgradeScore(participant.units),
      items:itemCount(participant.units),
      level:participant.level,
      gold:participant.goldLeft,
    }));

    const yours=rows.find(row=>row.placement===you.placement);
    if(!yours)return null;

    const buildMetric=(
      id:string,
      label:string,
      mine:number,
      all:number[],
      value:string,
      help:string,
    ):Metric=>{
      const ranked=rankMetric(all,mine);
      return {id,label,value,...ranked,help};
    };

    const metrics:Metric[]=[
      buildMetric(
        "board",
        "Investimento final",
        yours.board,
        rows.map(row=>row.board),
        yours.board+"g est.",
        "Estimativa pelo custo das unidades e quantidade de cópias necessária para cada estrela.",
      ),
      buildMetric(
        "upgrades",
        "Upgrades",
        yours.upgrades,
        rows.map(row=>row.upgrades),
        yours.upgrades+" pts",
        "2★ vale 1 ponto e 3★ vale 3. Mede densidade de upgrades, não qualidade de cada unidade.",
      ),
      buildMetric(
        "items",
        "Itens equipados",
        yours.items,
        rows.map(row=>row.items),
        String(yours.items),
        "Conta apenas itens equipados nas unidades do snapshot final retornado pela API.",
      ),
      buildMetric(
        "level",
        "Nível final",
        yours.level,
        rows.map(row=>row.level),
        "Nv. "+yours.level,
        "Compara apenas o nível final dos oito jogadores.",
      ),
    ];

    const score=Math.round(metrics.reduce((sum,metric)=>sum+metric.score,0)/metrics.length);
    const avgRank=metrics.reduce((sum,metric)=>sum+metric.rank,0)/metrics.length;
    const strongest=metrics.slice().sort((a,b)=>b.score-a.score)[0];
    const weakest=metrics.slice().sort((a,b)=>a.score-b.score)[0];

    return {
      metrics,
      score,
      avgRank:+avgRank.toFixed(1),
      strongest,
      weakest,
      placement:yours.placement,
      gold:yours.gold,
    };
  },[target,detail]);

  if(!data)return null;

  return <section className="match-scorecard">
    <div className="scorecard-head">
      <div>
        <span>GAME SCORECARD · SNAPSHOT FINAL</span>
        <h3>Como este board se comparou com a lobby</h3>
        <p>Quatro medidas observáveis desta partida, calculadas apenas contra os outros 7 boards do mesmo jogo.</p>
      </div>
      <div className="scorecard-index">
        <small>SNAPSHOT INDEX</small>
        <strong>{data.score}</strong>
        <span>{labelForScore(data.score)}</span>
      </div>
    </div>

    <div className="scorecard-metrics">
      {data.metrics.map(metric=>(
        <article key={metric.id}>
          <div className="scorecard-metric-head">
            <span>{metric.label}</span>
            <b>#{metric.rank}/{metric.total}</b>
          </div>
          <strong>{metric.value}</strong>
          <div className="scorecard-track"><i style={{width:metric.score+"%"}}/></div>
          <small>{metric.help}</small>
        </article>
      ))}
    </div>

    <div className="scorecard-read">
      <article>
        <span>MAIOR FORÇA FINAL</span>
        <strong>{data.strongest.label}</strong>
        <small>#{data.strongest.rank}/{data.strongest.total} na lobby</small>
      </article>
      <article>
        <span>MAIOR GAP FINAL</span>
        <strong>{data.weakest.label}</strong>
        <small>#{data.weakest.rank}/{data.weakest.total} na lobby</small>
      </article>
      <article>
        <span>CONTEXTO</span>
        <strong>{data.placement}º lugar · {data.gold}g finais</strong>
        <small>média das posições do scorecard: #{data.avgRank}</small>
      </article>
    </div>

    <p className="scorecard-note">O Snapshot Index não é nota de habilidade, execução ou economia. É apenas a média da posição relativa nestas quatro medidas finais; decisões por rodada, shop, HP anterior e posicionamento histórico não estão disponíveis.</p>
  </section>;
}
