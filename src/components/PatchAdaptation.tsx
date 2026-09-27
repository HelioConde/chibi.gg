import { useMemo } from "react";
import { TftMatch } from "../api/tft";

type Props={
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

function patchLabel(version:string){
  const match=String(version||"").match(/(\d+)\.(\d+)/);
  return match ? match[1]+"."+match[2] : (version||"desconhecido");
}

function avg(values:number[]){
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}

function pct(n:number,d:number){
  return d?Math.round(n/d*100):0;
}

export default function PatchAdaptation({matches,onEvidence}:Props){
  const patches=useMemo(()=>{
    const map=new Map<string,TftMatch[]>();
    for(const match of matches){
      const key=patchLabel(match.gameVersion||"");
      const list=map.get(key)||[];
      list.push(match);
      map.set(key,list);
    }

    return [...map.entries()].map(([patch,games])=>{
      const sorted=games.slice().sort((a,b)=>(Number(a.playedAt)||0)-(Number(b.playedAt)||0));
      const mean=avg(games.map(game=>game.placement))??0;
      const top4=pct(games.filter(game=>game.placement<=4).length,games.length);
      const block=Math.min(4,Math.floor(sorted.length/2));
      let adaptation:null|{early:number;recent:number;delta:number}=null;
      if(block>=2){
        const early=avg(sorted.slice(0,block).map(game=>game.placement))??0;
        const recent=avg(sorted.slice(-block).map(game=>game.placement))??0;
        adaptation={early:+early.toFixed(2),recent:+recent.toFixed(2),delta:+(recent-early).toFixed(2)};
      }
      return {
        patch,
        games:games.length,
        avg:+mean.toFixed(2),
        top4,
        adaptation,
        ids:games.map(game=>game.id),
        latest:Math.max(...games.map(game=>Number(game.playedAt)||0)),
      };
    }).sort((a,b)=>b.latest-a.latest);
  },[matches]);

  const current=patches[0]||null;

  return <section className="panel patch-adaptation">
    <div className="innovation-head">
      <div>
        <span>PATCH ADAPTATION</span>
        <h2>{current
          ? current.adaptation
            ? current.adaptation.delta<-.25
              ? "Você está se adaptando ao patch"
              : current.adaptation.delta>.25
                ? "O patch recente ainda está custando"
                : "Seu desempenho está estável no patch"
            : "Construindo sua curva de adaptação"
          : "Sem dados de patch"}
        </h2>
      </div>
      {current&&<small>Patch {current.patch}</small>}
    </div>

    {current&&current.adaptation&&<div className="adaptation-hero">
      <div>
        <span>Primeiro bloco</span>
        <strong>{current.adaptation.early}</strong>
      </div>
      <div className="adaptation-arrow">→</div>
      <div>
        <span>Bloco recente</span>
        <strong>{current.adaptation.recent}</strong>
      </div>
      <div className={"adaptation-delta "+(current.adaptation.delta<0?"good":current.adaptation.delta>0?"bad":"")}>
        {current.adaptation.delta>0?"+":""}{current.adaptation.delta}
      </div>
    </div>}

    <div className="patch-list">
      {patches.slice(0,4).map(row=>(
        <button key={row.patch} onClick={()=>onEvidence(row.ids,"Patch "+row.patch)}>
          <div>
            <strong>Patch {row.patch}</strong>
            <small>{row.games} partidas</small>
          </div>
          <div><span>Média</span><strong>{row.avg}</strong></div>
          <div><span>Top 4</span><strong>{row.top4}%</strong></div>
          <div><span>{row.adaptation?"Δ adaptação":"Amostra"}</span><strong>{row.adaptation?(row.adaptation.delta>0?"+":"")+row.adaptation.delta:"—"}</strong></div>
        </button>
      ))}
    </div>

    <p className="innovation-note">A curva compara blocos de partidas dentro do mesmo patch. Ela descreve adaptação observada, não mede aprendizado diretamente.</p>
  </section>;
}
