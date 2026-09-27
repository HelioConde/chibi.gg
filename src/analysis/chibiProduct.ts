import { TftMatch } from "../api/tft";

type Confidence="alta"|"média"|"baixa";

export type PersonalMetaLine={
  id:string;
  games:number;
  avgPlacement:number;
  top4Rate:number;
  firsts:number;
  fitScore:number;
  confidence:Confidence;
  matchIds:string[];
};

export type SessionCoach={
  games:number;
  avgPlacement:number|null;
  top4Rate:number;
  bottom2Rate:number;
  startedAt:number|null;
  endedAt:number|null;
  focus:string;
  reason:string;
  matchIds:string[];
};

export type LeakItem={
  id:string;
  title:string;
  description:string;
  evidence:string;
  severity:number;
  confidence:Confidence;
  matchIds:string[];
};

export type LeakMap={
  primary:LeakItem|null;
  items:LeakItem[];
};

function avg(values:number[]){
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}

function pct(n:number,d:number){
  return d?Math.round(n/d*100):0;
}

function confidence(games:number,total:number):Confidence{
  if(total>=20&&games>=6) return "alta";
  if(total>=10&&games>=3) return "média";
  return "baixa";
}

function confidenceWeight(value:Confidence){
  if(value==="alta") return 1;
  if(value==="média") return .8;
  return .55;
}

function coreTraits(match:TftMatch){
  return match.traits
    .filter(t=>t.numUnits>0&&(t.style>0||t.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,3)
    .map(t=>t.name);
}

export function buildPersonalMeta(matches:TftMatch[]):PersonalMetaLine[]{
  const valid=matches.filter(m=>m.placement>=1&&m.placement<=8);
  const map=new Map<string,TftMatch[]>();

  for(const match of valid){
    for(const trait of new Set(coreTraits(match))){
      const list=map.get(trait)||[];
      list.push(match);
      map.set(trait,list);
    }
  }

  return [...map.entries()]
    .filter(([,games])=>games.length>=2)
    .map(([id,games])=>{
      const mean=avg(games.map(g=>g.placement))??8;
      const top4=games.filter(g=>g.placement<=4).length;
      const firsts=games.filter(g=>g.placement===1).length;
      const placementScore=Math.max(0,Math.min(100,((8.5-mean)/7.5)*100));
      const top4Score=pct(top4,games.length);
      const sampleScore=Math.min(100,games.length*20);
      return {
        id,
        games:games.length,
        avgPlacement:+mean.toFixed(2),
        top4Rate:pct(top4,games.length),
        firsts,
        fitScore:Math.round(placementScore*.5+top4Score*.35+sampleScore*.15),
        confidence:confidence(games.length,valid.length),
        matchIds:games.map(g=>g.id),
      };
    })
    .sort((a,b)=>b.fitScore-a.fitScore||a.avgPlacement-b.avgPlacement)
    .slice(0,4);
}

export function buildSessionCoach(matches:TftMatch[]):SessionCoach{
  const valid=matches
    .filter(m=>m.placement>=1&&m.placement<=8&&Number(m.playedAt)>0)
    .slice()
    .sort((a,b)=>(Number(b.playedAt)||0)-(Number(a.playedAt)||0));

  if(!valid.length){
    return {games:0,avgPlacement:null,top4Rate:0,bottom2Rate:0,startedAt:null,endedAt:null,focus:"Jogue mais partidas",reason:"Ainda não há partidas suficientes para identificar uma sessão.",matchIds:[]};
  }

  const session:TftMatch[]=[valid[0]];
  const maxGap=2.5*60*60*1000;
  for(let i=1;i<valid.length;i++){
    const previous=Number(valid[i-1].playedAt)||0;
    const current=Number(valid[i].playedAt)||0;
    if(previous-current>maxGap) break;
    session.push(valid[i]);
  }

  const mean=avg(session.map(m=>m.placement));
  const top4=session.filter(m=>m.placement<=4);
  const bottom2=session.filter(m=>m.placement>=7);
  const primary=coreTraits(session[0])[0];
  const repeatedPrimary=primary?session.filter(m=>coreTraits(m)[0]===primary).length:0;

  let focus="Preserve a consistência";
  let reason="A sessão não mostra um vazamento dominante; mantenha o processo e compare com a próxima.";

  if(session.length<3){
    focus="Colete uma sessão maior";
    reason="Com menos de 3 partidas, o Chibi evita transformar ruído em recomendação.";
  }else if(bottom2.length/session.length>=.34){
    focus="Proteja seu piso";
    reason="Bottom 2 está concentrado nesta sessão. Evitar 7º/8º tende a estabilizar mais o resultado que perseguir highroll.";
  }else if(top4.length>=2&&session.filter(m=>m.placement===1).length===0){
    focus="Trabalhe a conversão";
    reason="Você chegou ao Top 4 mais de uma vez, mas ainda não converteu a sessão em 1º lugar.";
  }else if(repeatedPrimary/session.length>=.6){
    focus="Abra uma segunda linha";
    reason="Uma mesma linha dominou a sessão. O objetivo não é abandonar o que funciona, mas reduzir dependência de um único caminho.";
  }else if((mean??8)>4.5){
    focus="Reduza a variância";
    reason="A colocação média da sessão ficou abaixo do meio da lobby. O próximo foco é transformar derrotas grandes em 4º–6º.";
  }

  return {
    games:session.length,
    avgPlacement:mean==null?null:+mean.toFixed(2),
    top4Rate:pct(top4.length,session.length),
    bottom2Rate:pct(bottom2.length,session.length),
    startedAt:Number(session[session.length-1].playedAt)||null,
    endedAt:Number(session[0].playedAt)||null,
    focus,
    reason,
    matchIds:session.map(m=>m.id),
  };
}

export function buildLeakMap(matches:TftMatch[]):LeakMap{
  const valid=matches.filter(m=>m.placement>=1&&m.placement<=8);
  const total=valid.length;
  if(!total) return {primary:null,items:[]};

  const items:LeakItem[]=[];
  const bottom2=valid.filter(m=>m.placement>=7);
  const top4=valid.filter(m=>m.placement<=4);
  const wins=valid.filter(m=>m.placement===1);

  if(bottom2.length){
    const rate=pct(bottom2.length,total);
    const signalConfidence=confidence(bottom2.length,total);
    items.push({
      id:"bottom2",
      title:"Bottom 2",
      description:"Partidas que terminam em 7º/8º aumentam bastante a variância da amostra.",
      evidence:`${bottom2.length} de ${total} partidas · ${rate}%`,
      severity:Math.min(100,Math.round(rate*2.1*confidenceWeight(signalConfidence))),
      confidence:signalConfidence,
      matchIds:bottom2.map(m=>m.id),
    });
  }

  if(top4.length>=2){
    const conversion=pct(wins.length,top4.length);
    const signalConfidence=confidence(top4.length,total);
    items.push({
      id:"conversion",
      title:"Conversão",
      description:"Mede quantos Top 4 viraram vitória. Não diz por que a conversão falhou; mostra onde investigar.",
      evidence:`${wins.length} vitórias em ${top4.length} Top 4 · ${conversion}%`,
      severity:Math.round(Math.max(0,100-conversion)*confidenceWeight(signalConfidence)),
      confidence:signalConfidence,
      matchIds:top4.map(m=>m.id),
    });
  }

  const primary=valid.map(m=>coreTraits(m)[0]).filter(Boolean) as string[];
  const counts=new Map<string,TftMatch[]>();
  for(const match of valid){
    const line=coreTraits(match)[0];
    if(!line) continue;
    const list=counts.get(line)||[];
    list.push(match);
    counts.set(line,list);
  }
  const dominant=[...counts.entries()].sort((a,b)=>b[1].length-a[1].length)[0];
  if(dominant&&dominant[1].length>=2){
    const share=pct(dominant[1].length,total);
    if(share>=35){
      const signalConfidence=confidence(dominant[1].length,total);
      items.push({
        id:"dominance",
        title:"Dependência de linha",
        description:"Uma única identidade de board aparece em grande parte da amostra. Isso pode ser estilo pessoal ou sinal de pouca flexibilidade.",
        evidence:`${dominant[1].length} de ${total} partidas · ${share}%`,
        severity:Math.min(100,Math.round(Math.max(20,share)*confidenceWeight(signalConfidence))),
        confidence:signalConfidence,
        matchIds:dominant[1].map(m=>m.id),
      });
    }
  }

  const topLevel=avg(top4.map(m=>m.level));
  const bottom4=valid.filter(m=>m.placement>=5);
  const bottomLevel=avg(bottom4.map(m=>m.level));
  if(top4.length>=2&&bottom4.length>=2&&topLevel!=null&&bottomLevel!=null){
    const delta=bottomLevel-topLevel;
    if(delta>=.3){
      const signalConfidence=confidence(Math.min(top4.length,bottom4.length),total);
      items.push({
        id:"level-conversion",
        title:"Nível sem conversão",
        description:"Os Bottom 4 terminaram em nível igual ou maior que os Top 4. Chegar ao nível não foi suficiente para converter o board.",
        evidence:`Top 4: ${topLevel.toFixed(1)} · Bottom 4: ${bottomLevel.toFixed(1)}`,
        severity:Math.min(100,Math.round((45+delta*18)*confidenceWeight(signalConfidence))),
        confidence:signalConfidence,
        matchIds:bottom4.map(m=>m.id),
      });
    }
  }

  items.sort((a,b)=>b.severity-a.severity);
  return {primary:items[0]||null,items:items.slice(0,4)};
}
