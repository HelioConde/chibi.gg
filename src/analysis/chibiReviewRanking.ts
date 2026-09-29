import { TftMatch } from "../api/tft";

export type ReviewConfidence="alta"|"média"|"baixa";
export type ReviewTone="positive"|"warning"|"neutral";
export type ReviewSignalKind="strength"|"risk"|"change"|"pattern";

export type RankedReviewSignal={
  id:string;
  kind:ReviewSignalKind;
  eyebrow:string;
  title:string;
  body:string;
  evidence:string;
  confidence:ReviewConfidence;
  tone:ReviewTone;
  priority:number;
  matchIds:string[];
  subjectId?:string;
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

function pct(count:number,total:number){
  return total?Math.round(count/total*100):0;
}

function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,value));
}

function confidenceFor(sample:number,total:number):ReviewConfidence{
  if(total>=18&&sample>=6)return "alta";
  if(total>=10&&sample>=3)return "média";
  return "baixa";
}

function confidenceWeight(value:ReviewConfidence){
  if(value==="alta")return 1;
  if(value==="média")return .82;
  return .62;
}

function activeTraitIds(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,3)
    .map(trait=>trait.name);
}

function primaryTrait(match:TftMatch){
  return activeTraitIds(match)[0]||"";
}

function weightedPriority(base:number,confidence:ReviewConfidence){
  return clamp(Math.round(base*confidenceWeight(confidence)));
}

function signal(args:Omit<RankedReviewSignal,"priority"> & {priority:number}):RankedReviewSignal{
  return {...args,priority:clamp(Math.round(args.priority))};
}

export function buildRankedReviewSignals(matches:TftMatch[]):RankedReviewSignal[]{
  const valid=matches.filter(match=>match.placement>=1&&match.placement<=8);
  const total=valid.length;
  if(!total)return [];

  const results:RankedReviewSignal[]=[];
  const overallAvg=avg(valid.map(match=>match.placement))??4.5;
  const top4=valid.filter(match=>match.placement<=4);
  const bottom4=valid.filter(match=>match.placement>=5);
  const bottom2=valid.filter(match=>match.placement>=7);
  const wins=valid.filter(match=>match.placement===1);

  const trendWindow=Math.min(5,Math.floor(total/2));
  if(trendWindow>=3){
    const recent=valid.slice(0,trendWindow);
    const previous=valid.slice(trendWindow,trendWindow*2);
    const recentAvg=avg(recent.map(match=>match.placement))??0;
    const previousAvg=avg(previous.map(match=>match.placement))??0;
    const delta=recentAvg-previousAvg;
    const confidence=confidenceFor(trendWindow,total);
    const magnitude=Math.abs(delta);

    if(magnitude>=.22){
      results.push(signal({
        id:"recent-form",
        kind:"change",
        eyebrow:"MUDANÇA RECENTE",
        title:delta<0?"Seu bloco recente melhorou":"Seu bloco recente piorou",
        body:delta<0
          ? `As últimas ${trendWindow} partidas terminaram, em média, ${magnitude.toFixed(2)} posição melhor que o bloco anterior.`
          : `As últimas ${trendWindow} partidas terminaram, em média, ${magnitude.toFixed(2)} posição pior que o bloco anterior.`,
        evidence:`Últimas ${trendWindow}: ${recentAvg.toFixed(2)} · anteriores: ${previousAvg.toFixed(2)}`,
        confidence,
        tone:delta<0?"positive":"warning",
        priority:weightedPriority(58+magnitude*20,confidence),
        matchIds:[...recent,...previous].map(match=>match.id),
      }));
    }
  }

  if(total>=6){
    const rate=pct(bottom2.length,total);
    const confidence=confidenceFor(Math.max(bottom2.length,Math.min(total,6)),total);

    if(rate>=25){
      results.push(signal({
        id:"bottom2-risk",
        kind:"risk",
        eyebrow:"PISO DA SUA AMOSTRA",
        title:"Bottom 2 está pesando no seu resultado",
        body:"Seus resultados ruins estão chegando com frequência a 7º/8º. Isso é um sinal para investigar como transformar derrotas grandes em colocações intermediárias.",
        evidence:`${bottom2.length} de ${total} partidas terminaram em Bottom 2 · ${rate}%`,
        confidence,
        tone:"warning",
        priority:weightedPriority(62+Math.min(30,rate*.7),confidence),
        matchIds:bottom2.map(match=>match.id),
      }));
    }else if(rate<=12&&total>=8){
      results.push(signal({
        id:"bottom2-stability",
        kind:"strength",
        eyebrow:"ESTABILIDADE",
        title:"Você está protegendo bem o piso",
        body:"Poucas partidas da amostra terminaram em 7º/8º. Seu histórico recente mostra boa proteção contra resultados muito baixos.",
        evidence:`${bottom2.length} de ${total} partidas em Bottom 2 · ${rate}%`,
        confidence,
        tone:"positive",
        priority:weightedPriority(61+(12-rate),confidence),
        matchIds:valid.map(match=>match.id),
      }));
    }
  }

  if(top4.length>=3){
    const conversion=pct(wins.length,top4.length);
    const confidence=confidenceFor(top4.length,total);

    if(total<8){
      results.push(signal({
        id:"conversion-sample",
        kind:"pattern",
        eyebrow:"AMOSTRA INICIAL",
        title:`${top4.length} Top 4 carregados · ainda é cedo para chamar isso de padrão`,
        body:"O Chibi encontrou uma sequência forte de Top 4, mas a amostra ainda é pequena para avaliar conversão em vitória com segurança.",
        evidence:`${wins.length} vitória(s) em ${top4.length} Top 4 · ${total} partidas no contexto`,
        confidence:"baixa",
        tone:"neutral",
        priority:28,
        matchIds:top4.map(match=>match.id),
      }));
    }else if(conversion<=20){
      results.push(signal({
        id:"conversion-low",
        kind:"risk",
        eyebrow:"CONVERSÃO",
        title:"Seus Top 4 estão convertendo pouco em vitória",
        body:"Você chega à metade de cima da lobby, mas poucos desses jogos terminam em 1º. O sinal mostra onde revisar; ele não identifica sozinho a causa.",
        evidence:`${wins.length} vitória(s) em ${top4.length} Top 4 · conversão ${conversion}%`,
        confidence,
        tone:"warning",
        priority:weightedPriority(64+(20-conversion)*.9,confidence),
        matchIds:top4.map(match=>match.id),
      }));
    }else if(conversion>=40&&top4.length>=4){
      results.push(signal({
        id:"conversion-high",
        kind:"strength",
        eyebrow:"CONVERSÃO",
        title:"Você está convertendo bem seus Top 4",
        body:"Quando entra na metade de cima, uma parcela relevante das partidas vira vitória. Esse é um padrão positivo para usar como referência.",
        evidence:`${wins.length} vitória(s) em ${top4.length} Top 4 · conversão ${conversion}%`,
        confidence,
        tone:"positive",
        priority:weightedPriority(63+Math.min(20,(conversion-40)*.6),confidence),
        matchIds:top4.map(match=>match.id),
      }));
    }
  }

  const traitMap=new Map<string,TftMatch[]>();
  for(const match of valid){
    for(const id of new Set(activeTraitIds(match))){
      const list=traitMap.get(id)||[];
      list.push(match);
      traitMap.set(id,list);
    }
  }

  const traitStats=[...traitMap.entries()]
    .filter(([,games])=>games.length>=2)
    .map(([id,games])=>({
      id,
      games,
      average:avg(games.map(match=>match.placement))??8,
      top4Rate:pct(games.filter(match=>match.placement<=4).length,games.length),
    }));

  const bestTrait=traitStats
    .filter(row=>row.average<=overallAvg-.35)
    .sort((a,b)=>a.average-b.average||b.games.length-a.games.length)[0];

  if(bestTrait){
    const confidence=confidenceFor(bestTrait.games.length,total);
    const delta=overallAvg-bestTrait.average;
    results.push(signal({
      id:"trait-strength:"+bestTrait.id,
      kind:"strength",
      eyebrow:"LINHA PESSOAL",
      title:"Uma linha recorrente está acima da sua média",
      body:`Quando esta identidade apareceu no board final, sua colocação média foi ${delta.toFixed(2)} melhor que sua média geral nesta amostra.`,
      evidence:`${bestTrait.games.length} partidas · média ${bestTrait.average.toFixed(2)} · Top 4 ${bestTrait.top4Rate}%`,
      confidence,
      tone:"positive",
      priority:weightedPriority(60+delta*18+Math.min(10,bestTrait.games.length*1.5),confidence),
      matchIds:bestTrait.games.map(match=>match.id),
      subjectId:bestTrait.id,
    }));
  }

  const worstTrait=traitStats
    .filter(row=>row.average>=overallAvg+.45)
    .sort((a,b)=>b.average-a.average||b.games.length-a.games.length)[0];

  if(worstTrait){
    const confidence=confidenceFor(worstTrait.games.length,total);
    const delta=worstTrait.average-overallAvg;
    results.push(signal({
      id:"trait-risk:"+worstTrait.id,
      kind:"risk",
      eyebrow:"LINHA PARA INVESTIGAR",
      title:"Uma linha recorrente está abaixo da sua média",
      body:`Esta identidade terminou ${delta.toFixed(2)} posição pior que sua média geral na amostra. Isso não prova que a comp seja ruim; indica onde vale revisar sua execução.`,
      evidence:`${worstTrait.games.length} partidas · média ${worstTrait.average.toFixed(2)} · Top 4 ${worstTrait.top4Rate}%`,
      confidence,
      tone:"warning",
      priority:weightedPriority(62+delta*18+Math.min(8,worstTrait.games.length),confidence),
      matchIds:worstTrait.games.map(match=>match.id),
      subjectId:worstTrait.id,
    }));
  }

  const with3=valid.filter(match=>match.units.some(unit=>unit.tier>=3));
  const without3=valid.filter(match=>!match.units.some(unit=>unit.tier>=3));
  if(with3.length>=2&&without3.length>=2){
    const withAvg=avg(with3.map(match=>match.placement));
    const withoutAvg=avg(without3.map(match=>match.placement));
    if(withAvg!=null&&withoutAvg!=null){
      const delta=withoutAvg-withAvg;
      const magnitude=Math.abs(delta);
      if(magnitude>=.55){
        const confidence=confidenceFor(Math.min(with3.length,without3.length),total);
        results.push(signal({
          id:"three-star-split",
          kind:delta>0?"strength":"pattern",
          eyebrow:"PADRÃO DE 3★",
          title:delta>0?"Seus boards com 3★ terminaram melhor":"3★ não está separando seus melhores resultados",
          body:delta>0
            ?"Na amostra, partidas cujo board final tinha pelo menos uma unidade 3★ terminaram melhor. É associação, não prova de causa."
            :"Na amostra, partidas com unidade 3★ terminaram pior ou semelhante às demais. O upgrade sozinho não explica sucesso.",
          evidence:`Com 3★: ${withAvg.toFixed(2)} · sem 3★: ${withoutAvg.toFixed(2)}`,
          confidence,
          tone:delta>0?"positive":"neutral",
          priority:weightedPriority(55+magnitude*14,confidence),
          matchIds:[...with3,...without3].map(match=>match.id),
        }));
      }
    }
  }

  if(top4.length>=2&&bottom4.length>=2){
    const topLevel=avg(top4.map(match=>match.level));
    const bottomLevel=avg(bottom4.map(match=>match.level));
    if(topLevel!=null&&bottomLevel!=null){
      const delta=topLevel-bottomLevel;
      const magnitude=Math.abs(delta);
      if(magnitude>=.4){
        const confidence=confidenceFor(Math.min(top4.length,bottom4.length),total);
        results.push(signal({
          id:"level-split",
          kind:delta>0?"pattern":"risk",
          eyebrow:"NÍVEL FINAL",
          title:delta>0?"Top 4 terminaram em nível mais alto":"Nível alto não está garantindo conversão",
          body:delta>0
            ?"Seus Top 4 encerraram em nível final mais alto que seus Bottom 4. O dado descreve o board final; não revela quando você subiu de nível."
            :"Seus Bottom 4 terminaram em nível semelhante ou maior que seus Top 4. Isso sugere revisar a qualidade do board final, não apenas o nível alcançado.",
          evidence:`Top 4: nível ${topLevel.toFixed(1)} · Bottom 4: ${bottomLevel.toFixed(1)}`,
          confidence,
          tone:delta>0?"neutral":"warning",
          priority:weightedPriority(56+magnitude*18,confidence),
          matchIds:[...top4,...bottom4].map(match=>match.id),
        }));
      }
    }
  }

  const bottom2WithGold=bottom2.filter(match=>match.goldLeft>=10);
  if(bottom2.length>=2&&bottom2WithGold.length>=2){
    const share=pct(bottom2WithGold.length,bottom2.length);
    const confidence=confidenceFor(bottom2WithGold.length,total);
    results.push(signal({
      id:"bottom2-gold-left",
      kind:"risk",
      eyebrow:"OURO FINAL",
      title:"Parte dos seus Bottom 2 terminou com ouro sobrando",
      body:"O ouro final não mostra sua economia rodada a rodada, mas identifica partidas que merecem revisão para entender se havia recursos não convertidos no fim.",
      evidence:`${bottom2WithGold.length} de ${bottom2.length} Bottom 2 terminaram com 10g+ · ${share}%`,
      confidence,
      tone:"warning",
      priority:weightedPriority(57+Math.min(24,share*.25),confidence),
      matchIds:bottom2WithGold.map(match=>match.id),
    }));
  }

  const primaryCounts=new Map<string,TftMatch[]>();
  for(const match of valid){
    const id=primaryTrait(match);
    if(!id)continue;
    const list=primaryCounts.get(id)||[];
    list.push(match);
    primaryCounts.set(id,list);
  }
  const dominant=[...primaryCounts.entries()].sort((a,b)=>b[1].length-a[1].length)[0];
  if(dominant&&dominant[1].length>=3){
    const share=pct(dominant[1].length,total);
    if(share>=45){
      const confidence=confidenceFor(dominant[1].length,total);
      results.push(signal({
        id:"line-dominance:"+dominant[0],
        kind:"pattern",
        eyebrow:"FLEXIBILIDADE",
        title:"Uma linha está dominando sua amostra",
        body:"Isso pode ser especialização intencional ou baixa diversidade de linhas. O Chibi mostra o padrão sem assumir que ele é um erro.",
        evidence:`${dominant[1].length} de ${total} partidas tiveram a mesma identidade principal · ${share}%`,
        confidence,
        tone:"neutral",
        priority:weightedPriority(52+Math.min(28,(share-45)*.65),confidence),
        matchIds:dominant[1].map(match=>match.id),
        subjectId:dominant[0],
      }));
    }
  }

  if(results.length<3){
    const confidence=confidenceFor(total,total);
    results.push(signal({
      id:"sample-baseline",
      kind:"pattern",
      eyebrow:"LEITURA GERAL",
      title:"Sua amostra ainda não tem três sinais fortes",
      body:"O Chibi prefere deixar um espaço menos assertivo a transformar variação normal em recomendação. Mais partidas aumentam a capacidade de separar padrão de ruído.",
      evidence:`${total} partidas carregadas · média geral ${overallAvg.toFixed(2)}`,
      confidence,
      tone:"neutral",
      priority:24,
      matchIds:valid.map(match=>match.id),
    }));
  }

  const deduped=results
    .sort((a,b)=>b.priority-a.priority)
    .filter((item,index,list)=>list.findIndex(candidate=>candidate.id===item.id)===index);

  const chosen:RankedReviewSignal[]=[];
  const take=(predicate:(item:RankedReviewSignal)=>boolean)=>{
    const found=deduped.find(item=>!chosen.includes(item)&&predicate(item));
    if(found)chosen.push(found);
  };

  take(item=>item.priority>=48&&item.kind==="risk");
  take(item=>item.priority>=48&&item.kind==="strength");
  take(item=>item.priority>=45&&item.kind==="change");

  for(const item of deduped){
    if(chosen.length>=3)break;
    if(!chosen.includes(item))chosen.push(item);
  }

  return chosen
    .slice(0,3)
    .sort((a,b)=>b.priority-a.priority);
}
