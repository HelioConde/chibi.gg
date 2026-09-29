import { TftMatch } from "../api/tft";

export type InsightTone = "positive"|"warning"|"neutral";

export type ChibiInsight = {
  id:string;
  title:string;
  body:string;
  evidence:string;
  tone:InsightTone;
  confidence:"alta"|"média"|"baixa";
  subject?:string;
};

export type ChibiDNA = {
  sampleSize:number;
  avgPlacement:number|null;
  top4Rate:number;
  winRate:number;
  bottom2Rate:number;
  consistency:number;
  flexibility:number;
  conversion:number;
  stability:number;
  placements:number[];
  insights:ChibiInsight[];
};

function avg(values:number[]){
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
}

function pct(n:number,d:number){
  return d ? Math.round((n/d)*100) : 0;
}

function clamp(v:number,min=0,max=100){
  return Math.max(min,Math.min(max,v));
}

function coreTraits(match:TftMatch){
  return match.traits
    .filter(t=>t.numUnits>0 && (t.style>0 || t.numUnits>=2))
    .sort((a,b)=>b.style-a.style || b.numUnits-a.numUnits)
    .slice(0,3)
    .map(t=>t.name);
}

function confidenceFor(games:number,total:number){
  if(total>=20 && games>=6) return "alta" as const;
  if(total>=12 && games>=3) return "média" as const;
  return "baixa" as const;
}

export function buildChibiDNA(matches:TftMatch[]):ChibiDNA{
  const valid=matches.filter(m=>m.placement>=1&&m.placement<=8);
  const total=valid.length;
  const placements=valid.map(m=>m.placement);
  const mean=avg(placements);

  const top4=valid.filter(m=>m.placement<=4);
  const wins=valid.filter(m=>m.placement===1);
  const bottom2=valid.filter(m=>m.placement>=7);

  const variance=mean==null?0:avg(placements.map(p=>(p-mean)**2))||0;
  const std=Math.sqrt(variance);
  const consistency=clamp(Math.round(100-(std/3.5)*100));

  const primary=valid.map(m=>coreTraits(m)[0]).filter(Boolean) as string[];
  const primaryCounts=new Map<string,number>();
  for(const line of primary) primaryCounts.set(line,(primaryCounts.get(line)||0)+1);
  const uniquePrimary=primaryCounts.size;
  const maxPrimary=Math.max(0,...primaryCounts.values());
  const diversityRatio=primary.length ? uniquePrimary/primary.length : 0;
  const nonDominance=primary.length ? 1-(maxPrimary/primary.length) : 0;
  const flexibility=clamp(Math.round((diversityRatio*0.6+nonDominance*0.4)*100));

  const conversion=pct(wins.length,top4.length);
  const stability=100-pct(bottom2.length,total);

  const insights:ChibiInsight[]=[];

  const trendWindow=Math.min(6,Math.floor(total/2));
  if(trendWindow>=3){
    const recent=valid.slice(0,trendWindow);
    const previous=valid.slice(trendWindow,trendWindow*2);
    const recentAvg=avg(recent.map(m=>m.placement));
    const previousAvg=avg(previous.map(m=>m.placement));
    if(recentAvg!=null && previousAvg!=null){
      const delta=recentAvg-previousAvg;
      insights.push({
        id:"form",
        title:delta<-0.25?"Forma recente melhorando":delta>0.25?"Forma recente em queda":"Forma recente estável",
        body:delta<-0.25
          ? `Suas ${trendWindow} partidas mais recentes tiveram colocação média melhor que as ${trendWindow} anteriores.`
          : delta>0.25
            ? `Suas ${trendWindow} partidas mais recentes tiveram colocação média pior que as ${trendWindow} anteriores.`
            : "A diferença entre os dois blocos comparáveis é pequena.",
        evidence:`Últimas ${trendWindow}: ${recentAvg.toFixed(2)} · Anteriores: ${previousAvg.toFixed(2)}`,
        tone:delta<-0.25?"positive":delta>0.25?"warning":"neutral",
        confidence:total>=12?"média":"baixa",
      });
    }
  }

  const traitMap=new Map<string,{games:number;placements:number[]}>();
  for(const match of valid){
    for(const trait of new Set(coreTraits(match))){
      const current=traitMap.get(trait)||{games:0,placements:[]};
      current.games++;
      current.placements.push(match.placement);
      traitMap.set(trait,current);
    }
  }

  const traitStats=[...traitMap.entries()]
    .filter(([,v])=>v.games>=2)
    .map(([name,v])=>({name,games:v.games,avg:avg(v.placements)??9}))
    .sort((a,b)=>a.avg-b.avg||b.games-a.games);

  if(traitStats[0]){
    const t=traitStats[0];
    insights.push({
      id:"best-trait",
      title:total<8?"Linha recorrente nesta amostra":"Melhor média entre linhas repetidas",
      subject:t.name,
      body:total<8
        ?"Esta linha apareceu mais de uma vez no recorte atual. Ainda é cedo para tratar a média como padrão estável."
        :"Entre as linhas repetidas na amostra, esta foi a que terminou melhor em média.",
      evidence:`${t.games} partidas · média ${t.avg.toFixed(2)}`,
      tone:total<8?"neutral":"positive",
      confidence:confidenceFor(t.games,total),
    });
  }

  const with3=valid.filter(m=>m.units.some(u=>u.tier>=3));
  const without3=valid.filter(m=>!m.units.some(u=>u.tier>=3));
  const with3Avg=avg(with3.map(m=>m.placement));
  const without3Avg=avg(without3.map(m=>m.placement));
  if(with3.length>=2 && without3.length>=2 && with3Avg!=null && without3Avg!=null){
    const better=with3Avg<without3Avg;
    insights.push({
      id:"three-star",
      title:better?"Partidas com 3★ tiveram melhor média":"3★ não teve vantagem clara",
      body:better
        ? "Partidas em que seu board final teve pelo menos uma unidade 3★ terminaram melhor na amostra."
        : "Ter uma unidade 3★ no board final não esteve associado a uma colocação melhor nesta amostra.",
      evidence:`Com 3★: ${with3Avg.toFixed(2)} · Sem 3★: ${without3Avg.toFixed(2)}`,
      tone:better?"positive":"warning",
      confidence:confidenceFor(Math.min(with3.length,without3.length),total),
    });
  }

  const topLevel=avg(top4.map(m=>m.level));
  const bottom=valid.filter(m=>m.placement>=5);
  const bottomLevel=avg(bottom.map(m=>m.level));
  if(top4.length>=2 && bottom.length>=2 && topLevel!=null && bottomLevel!=null){
    const delta=topLevel-bottomLevel;
    if(Math.abs(delta)>=0.35){
      insights.push({
        id:"level",
        title:delta>0?"Top 4 terminaram em nível mais alto":"Nível final não separou seus Top 4",
        body:delta>0
          ? "Na amostra, suas partidas de Top 4 encerraram com nível final mais alto que as de Bottom 4."
          : "Na amostra, as partidas de Bottom 4 terminaram em nível semelhante ou maior. O nível final sozinho não diferenciou os resultados.",
        evidence:`Top 4: nível ${topLevel.toFixed(1)} · Bottom 4: ${bottomLevel.toFixed(1)}`,
        tone:delta>0?"positive":"warning",
        confidence:confidenceFor(Math.min(top4.length,bottom.length),total),
      });
    }
  }

  if(total>=8){
    insights.push({
      id:"risk",
      title:bottom2.length/total>=0.25?"Risco de bottom out elevado":"Boa proteção contra bottom 2",
      body:bottom2.length/total>=0.25
        ? "Uma parcela relevante das partidas carregadas terminou em 7º ou 8º. Isso sugere que reduzir derrotas muito baixas pode ter mais impacto que buscar mais primeiros."
        : "Poucas partidas da amostra terminaram em 7º ou 8º, sinal de boa estabilidade recente.",
      evidence:`${bottom2.length} de ${total} partidas em Bottom 2`,
      tone:bottom2.length/total>=0.25?"warning":"positive",
      confidence:total>=12?"média":"baixa",
    });
  }

  return {
    sampleSize:total,
    avgPlacement:mean==null?null:+mean.toFixed(2),
    top4Rate:pct(top4.length,total),
    winRate:pct(wins.length,total),
    bottom2Rate:pct(bottom2.length,total),
    consistency,
    flexibility,
    conversion,
    stability,
    placements,
    insights:insights.slice(0,5),
  };
}
