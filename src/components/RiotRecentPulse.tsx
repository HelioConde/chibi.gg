import { useMemo } from "react";
import { TftMatch } from "../api/tft";

type Props={
  matches:TftMatch[];
};

function summarize(matches:TftMatch[]){
  const total=Math.max(1,matches.length);
  const average=matches.reduce((sum,match)=>sum+match.placement,0)/total;
  const top4=matches.filter(match=>match.placement<=4).length;
  const bottom2=matches.filter(match=>match.placement>=7).length;
  const avgLevel=matches.reduce((sum,match)=>sum+match.level,0)/total;
  const avgGold=matches.reduce((sum,match)=>sum+match.goldLeft,0)/total;
  return {
    average:+average.toFixed(2),
    top4Rate:Math.round(top4/total*100),
    bottom2Rate:Math.round(bottom2/total*100),
    avgLevel:+avgLevel.toFixed(1),
    avgGold:+avgGold.toFixed(1),
  };
}

export default function RiotRecentPulse({matches}:Props){
  const data=useMemo(()=>{
    const current=matches.slice(0,5);
    if(current.length<3)return null;
    const previous=matches.slice(5,10);
    const now=summarize(current);
    const before=previous.length>=3?summarize(previous):null;
    const delta=before?+(now.average-before.average).toFixed(2):null;
    return {
      games:current.length,
      now,
      before,
      delta,
      tone:delta==null?"neutral":delta<=-.35?"good":delta>=.35?"warning":"neutral",
    };
  },[matches]);

  if(!data)return null;

  return <section className={"riot-recent-pulse "+data.tone}>
    <div className="riot-pulse-copy">
      <span>RECENTE · TFT-MATCH-V1</span>
      <strong>Últimas {data.games} partidas</strong>
      <small>{data.before
        ? data.delta===0
          ?"ritmo parecido com as 5 anteriores"
          : data.delta!<0
            ?"colocação média melhorou "+Math.abs(data.delta!).toFixed(2)
            :"colocação média piorou "+Math.abs(data.delta!).toFixed(2)
        :"primeiro bloco recente carregado"}</small>
    </div>

    <div className="riot-pulse-metrics">
      <article><span>Média</span><b>{data.now.average}</b>{data.before&&<small>antes {data.before.average}</small>}</article>
      <article><span>Top 4</span><b>{data.now.top4Rate}%</b>{data.before&&<small>antes {data.before.top4Rate}%</small>}</article>
      <article><span>Bottom 2</span><b>{data.now.bottom2Rate}%</b>{data.before&&<small>antes {data.before.bottom2Rate}%</small>}</article>
      <article><span>Nível final</span><b>{data.now.avgLevel}</b><small>média do bloco</small></article>
      <article><span>Ouro final</span><b>{data.now.avgGold}g</b><small>média do bloco</small></article>
    </div>
  </section>;
}
