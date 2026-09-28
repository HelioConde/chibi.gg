import { useMemo } from "react";
import { TftMatch } from "../api/tft";

type Props={
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

type LineStat={
  id:string;
  games:number;
  avg:number;
  top4:number;
  ids:string[];
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

function primaryTrait(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function aggregateLines(games:TftMatch[]):LineStat[]{
  const map=new Map<string,TftMatch[]>();

  for(const match of games){
    const id=primaryTrait(match);
    if(!id)continue;
    const rows=map.get(id)||[];
    rows.push(match);
    map.set(id,rows);
  }

  return [...map.entries()]
    .map(([id,rows])=>({
      id,
      games:rows.length,
      avg:+((avg(rows.map(row=>row.placement))??0).toFixed(2)),
      top4:pct(rows.filter(row=>row.placement<=4).length,rows.length),
      ids:rows.map(row=>row.id),
    }))
    .sort((a,b)=>b.games-a.games||a.avg-b.avg);
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
        lines:aggregateLines(games),
      };
    }).sort((a,b)=>b.latest-a.latest);
  },[matches]);

  const current=patches[0]||null;
  const previous=patches[1]||null;
  const freshnessDays=current?.latest
    ? Math.floor((Date.now()-current.latest)/86400000)
    : null;
  const stale=freshnessDays!=null&&freshnessDays>14;

  const personalImpact=useMemo(()=>{
    if(!current)return [];

    const previousById=new Map((previous?.lines||[]).map(line=>[line.id,line]));
    const currentById=new Map(current.lines.map(line=>[line.id,line]));
    const signals:Array<{
      id:string;
      tone:"good"|"warning"|"neutral";
      title:string;
      body:string;
      evidence:string;
      ids:string[];
      priority:number;
    }>=[];

    for(const line of current.lines){
      const before=previousById.get(line.id);

      if(before&&line.games>=2&&before.games>=2){
        const delta=+(line.avg-before.avg).toFixed(2);
        if(delta<=-.45){
          signals.push({
            id:"improved:"+line.id,
            tone:"good",
            title:clean(line.id)+" melhorou no seu histórico",
            body:"A mesma linha terminou melhor no patch atual do que na amostra anterior.",
            evidence:"Média "+before.avg+" → "+line.avg+" · "+line.games+" jogos atuais",
            ids:[...line.ids,...before.ids],
            priority:Math.abs(delta)*10+line.games,
          });
        }else if(delta>=.45){
          signals.push({
            id:"worse:"+line.id,
            tone:"warning",
            title:clean(line.id)+" está custando mais",
            body:"Essa linha continua no seu pool, mas sua colocação média piorou na comparação pessoal entre patches.",
            evidence:"Média "+before.avg+" → "+line.avg+" · "+line.games+" jogos atuais",
            ids:[...line.ids,...before.ids],
            priority:Math.abs(delta)*10+line.games+4,
          });
        }
      }else if(!before&&line.games>=2){
        signals.push({
          id:"new:"+line.id,
          tone:"neutral",
          title:clean(line.id)+" entrou no seu pool",
          body:"Essa identidade não aparecia na amostra anterior e já se repetiu no patch atual.",
          evidence:line.games+" jogos · média "+line.avg+" · Top 4 "+line.top4+"%",
          ids:line.ids,
          priority:line.games+2,
        });
      }
    }

    if(previous){
      for(const line of previous.lines){
        if(line.games<2||currentById.has(line.id))continue;
        signals.push({
          id:"missing:"+line.id,
          tone:"neutral",
          title:clean(line.id)+" sumiu do seu histórico recente",
          body:"Era uma linha recorrente na amostra anterior e ainda não apareceu no patch atual.",
          evidence:line.games+" jogos no patch "+previous.patch+" · média "+line.avg,
          ids:line.ids,
          priority:line.games,
        });
      }
    }

    return signals.sort((a,b)=>b.priority-a.priority).slice(0,4);
  },[current,previous]);

  return <section className="panel patch-adaptation patch-for-you">
    <div className="innovation-head">
      <div>
        <span>PATCH PARA VOCÊ</span>
        <h2>{current
          ? stale
            ? "Amostra histórica deste patch"
            : current.adaptation
              ? current.adaptation.delta<-.25
                ? "Você está se adaptando ao patch"
                : current.adaptation.delta>.25
                  ? "O patch atual ainda está custando"
                  : "Seu desempenho está estável no patch"
              : "Construindo sua curva de adaptação"
          : "Sem dados de patch"}
        </h2>
        <p className="patch-personal-copy">Quais linhas do seu próprio histórico melhoraram, pioraram, entraram ou saíram do pool.</p>
      </div>
      {current&&<small>Patch {current.patch}{stale&&freshnessDays!=null?" · "+freshnessDays+"d atrás":""}</small>}
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

    {personalImpact.length>0&&<div className="patch-personal-impact">
      <div className="patch-impact-head">
        <span>MUDANÇAS NO SEU POOL</span>
        <small>{previous?"Patch "+previous.patch+" → "+current?.patch:"Somente patch atual"}</small>
      </div>
      <div className="patch-impact-grid">
        {personalImpact.map(signal=>(
          <button className={signal.tone} onClick={()=>onEvidence(signal.ids,"Patch pessoal · "+signal.title)} key={signal.id}>
            <span>{signal.tone==="good"?"MELHOROU":signal.tone==="warning"?"REVISAR":"MUDANÇA"}</span>
            <strong>{signal.title}</strong>
            <p>{signal.body}</p>
            <small>{signal.evidence}</small>
          </button>
        ))}
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

    <p className="innovation-note">{stale
      ? "Esta leitura usa uma amostra histórica. Ela não descreve necessariamente seu desempenho atual."
      : "Mudanças entre patches descrevem seu histórico observado. Elas não provam que um buff ou nerf específico causou a diferença."}</p>
  </section>;
}
