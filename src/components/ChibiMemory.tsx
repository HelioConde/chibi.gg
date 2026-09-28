import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import {
  buildMemoryInsight,
  ChibiMemoryInsight,
  getMemoryHistory,
  recordMemorySnapshot,
} from "../chibiMemory";

type Props={
  playerKey:string;
  matches:TftMatch[];
};

function formatDate(value:number){
  return new Date(value).toLocaleDateString("pt-BR",{
    day:"2-digit",
    month:"2-digit",
    year:"2-digit",
  });
}

export default function ChibiMemory({playerKey,matches}:Props){
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const history=recordMemorySnapshot(playerKey,matches);
    setVersion(history.length);
  },[playerKey,matches]);

  const insight=useMemo<ChibiMemoryInsight|null>(
    ()=>{
      void version;
      return buildMemoryInsight(playerKey,matches);
    },
    [playerKey,matches,version]
  );

  const history=useMemo(
    ()=>{
      void version;
      return getMemoryHistory(playerKey).slice().reverse().slice(0,5);
    },
    [playerKey,version]
  );

  if(!insight) return null;

  return <section className={"panel chibi-memory tone-"+insight.tone}>
    <div className="memory-head">
      <div>
        <span>CHIBI MEMORY</span>
        <h2>{insight.title}</h2>
        <p>{insight.body}</p>
      </div>
      <small>{history.length} snapshot{history.length===1?"":"s"}</small>
    </div>

    <div className="memory-compare">
      <article>
        <span>AGORA</span>
        <strong>{insight.current.avgPlacement??"—"}</strong>
        <small>média · Top 4 {insight.current.top4Rate}% · Bottom 2 {insight.current.bottom2Rate}%</small>
      </article>

      <div className="memory-arrow">→</div>

      <article>
        <span>ANTERIOR</span>
        <strong>{insight.previous?.avgPlacement??"—"}</strong>
        <small>{insight.previous
          ? "média · Top 4 "+insight.previous.top4Rate+"% · Bottom 2 "+insight.previous.bottom2Rate+"%"
          : "ainda sem leitura anterior"}</small>
      </article>
    </div>

    {insight.recurringCount>=2&&<div className="memory-recurring">
      <span>PADRÃO RECORRENTE</span>
      <strong>{insight.current.primaryLeakTitle||"Sinal principal"}</strong>
      <small>apareceu em {insight.recurringCount} leituras recentes</small>
    </div>}

    {history.length>1&&<details className="memory-history">
      <summary>
        <span><b>Ver histórico de leituras</b><small>Snapshots salvos neste navegador</small></span>
        <em>{history.length}</em>
      </summary>
      <div className="memory-history-list">
        {history.map(item=>(
          <article key={item.id+item.createdAt}>
            <div>
              <strong>{formatDate(item.createdAt)}</strong>
              <small>{item.sampleSize} partidas · {item.archetype}</small>
            </div>
            <div>
              <span>Média {item.avgPlacement??"—"}</span>
              <span>{item.primaryLeakTitle||"Sem leak dominante"}</span>
            </div>
          </article>
        ))}
      </div>
    </details>}

    <p className="memory-note">A memória fica apenas neste navegador por enquanto. Quando houver conta, podemos sincronizar os snapshots no Supabase.</p>
  </section>;
}
