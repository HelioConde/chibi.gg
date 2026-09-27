import { TftMatch, TftMatchDetail, TftTrait, TftUnit } from "../api/tft";

type Participant=TftMatchDetail["match"]["participants"][number];

export type LobbyAutopsySignal={
  id:string;
  tone:"good"|"warning"|"neutral";
  title:string;
  body:string;
  evidence:string;
};

export type LobbyAutopsy={
  summary:string;
  priority:string;
  signals:LobbyAutopsySignal[];
  contested:Array<{
    characterId:string;
    opponents:number;
    copies:number;
  }>;
  closest:null|{
    placement:number;
    similarity:number;
    sharedUnits:string[];
    sharedTraits:string[];
    levelDelta:number;
    threeStarDelta:number;
  };
  benchmarks:{
    yourLevel:number;
    top4Level:number|null;
    lobbyLevel:number|null;
    yourThreeStars:number;
    top4ThreeStars:number|null;
    yourGold:number;
    lobbyGold:number|null;
  };
};

function avg(values:number[]){
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}

function activeTraitIds(traits:TftTrait[]){
  return traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,5)
    .map(trait=>trait.name);
}

function unitIds(units:TftUnit[]){
  return units.map(unit=>unit.characterId);
}

function threeStars(units:TftUnit[]){
  return units.filter(unit=>unit.tier>=3).length;
}

function jaccard(a:string[],b:string[]){
  const left=new Set(a);
  const right=new Set(b);
  if(!left.size&&!right.size) return 1;
  const shared=[...left].filter(value=>right.has(value)).length;
  const union=new Set([...left,...right]).size;
  return union?shared/union:0;
}

function similarity(a:Participant,b:Participant){
  const unit=jaccard(unitIds(a.units),unitIds(b.units));
  const trait=jaccard(activeTraitIds(a.traits),activeTraitIds(b.traits));
  return unit*.68+trait*.32;
}

export function buildLobbyAutopsy(target:TftMatch,detail:TftMatchDetail):LobbyAutopsy{
  const participants=detail.match.participants.slice();
  const you=participants.find(participant=>participant.placement===target.placement) || {
    placement:target.placement,
    level:target.level,
    goldLeft:target.goldLeft,
    damageToPlayers:target.damageToPlayers,
    playersEliminated:target.playersEliminated||0,
    augments:target.augments,
    traits:target.traits,
    units:target.units,
  };

  const opponents=participants.filter(participant=>participant!==you);
  const yourUnits=new Set(unitIds(you.units));

  const contested=[...yourUnits].map(characterId=>{
    const users=opponents.filter(participant=>participant.units.some(unit=>unit.characterId===characterId));
    const copies=users.reduce(
      (sum,participant)=>sum+participant.units.filter(unit=>unit.characterId===characterId).length,
      0,
    );
    return {characterId,opponents:users.length,copies};
  })
    .filter(row=>row.opponents>0)
    .sort((a,b)=>b.opponents-a.opponents||b.copies-a.copies);

  const closestRaw=opponents
    .map(participant=>({participant,score:similarity(you,participant)}))
    .sort((a,b)=>b.score-a.score)[0]||null;

  const closest=closestRaw&&closestRaw.score>=.15 ? {
    placement:closestRaw.participant.placement,
    similarity:Math.round(closestRaw.score*100),
    sharedUnits:unitIds(you.units).filter(id=>unitIds(closestRaw.participant.units).includes(id)),
    sharedTraits:activeTraitIds(you.traits).filter(id=>activeTraitIds(closestRaw.participant.traits).includes(id)),
    levelDelta:closestRaw.participant.level-you.level,
    threeStarDelta:threeStars(closestRaw.participant.units)-threeStars(you.units),
  } : null;

  const top4=participants.filter(participant=>participant.placement<=4);
  const top4Level=avg(top4.map(participant=>participant.level));
  const lobbyLevel=avg(participants.map(participant=>participant.level));
  const top4ThreeStars=avg(top4.map(participant=>threeStars(participant.units)));
  const lobbyGold=avg(participants.map(participant=>participant.goldLeft));

  const signals:LobbyAutopsySignal[]=[];

  if(contested.length){
    const heavy=contested.filter(row=>row.opponents>=2);
    const title=heavy.length
      ? "Seu board teve contestação visível"
      : "Parte do seu board apareceu em outros jogadores";
    signals.push({
      id:"contest",
      tone:heavy.length?"warning":"neutral",
      title,
      body:heavy.length
        ? heavy.length+" unidade(s) do seu board final apareceram em pelo menos 2 adversários."
        : contested.length+" unidade(s) do seu board final também apareceram em outro board.",
      evidence:contested.slice(0,4).map(row=>row.opponents+" rival(is)").join(" · "),
    });
  }

  if(top4Level!=null){
    const delta=you.level-top4Level;
    if(delta<=-.75){
      signals.push({
        id:"level-gap",
        tone:"warning",
        title:"Seu nível final ficou abaixo do Top 4",
        body:"Você terminou no nível "+you.level+", enquanto o Top 4 terminou em média no nível "+top4Level.toFixed(1)+".",
        evidence:"Diferença de "+Math.abs(delta).toFixed(1)+" nível",
      });
    }else if(delta>=.75&&you.placement>=5){
      signals.push({
        id:"level-no-conversion",
        tone:"warning",
        title:"Nível alto não virou colocação",
        body:"Seu nível final ficou acima da média do Top 4, mas a colocação terminou fora dele.",
        evidence:"Você "+you.level+" · Top 4 "+top4Level.toFixed(1),
      });
    }
  }

  if(top4ThreeStars!=null){
    const yours=threeStars(you.units);
    if(yours+0.6<top4ThreeStars){
      signals.push({
        id:"star-gap",
        tone:"warning",
        title:"Seu board final teve menos 3★ que o Top 4",
        body:"Seu board terminou com "+yours+" unidade(s) 3★; o Top 4 teve média "+top4ThreeStars.toFixed(1)+".",
        evidence:"Snapshot do board final",
      });
    }
  }

  if(lobbyGold!=null&&you.placement>=5&&you.goldLeft>=10&&you.goldLeft>=lobbyGold+5){
    signals.push({
      id:"gold-left",
      tone:"warning",
      title:"Você terminou com ouro acima da média da lobby",
      body:"O snapshot final mostra "+you.goldLeft+"g, contra média de "+lobbyGold.toFixed(1)+"g na lobby.",
      evidence:"Isso não prova erro de economia; indica recurso final para revisar.",
    });
  }

  if(closest&&closest.placement<you.placement&&closest.similarity>=30){
    signals.push({
      id:"similar-better",
      tone:"neutral",
      title:"Um board parecido terminou melhor",
      body:"O jogador em "+closest.placement+"º teve estrutura "+closest.similarity+"% semelhante à sua no snapshot final.",
      evidence:"Compare nível, 3★ e unidades compartilhadas.",
    });
  }

  if(!signals.length){
    signals.push({
      id:"no-dominant",
      tone:"neutral",
      title:"Nenhum diferencial simples domina o snapshot",
      body:"Nível, contestação e estrelas finais não mostram um contraste forte o suficiente para explicar a colocação sozinhos.",
      evidence:"Vale revisar itens, augments e decisões que a API não captura.",
    });
  }

  const warning=signals.find(signal=>signal.tone==="warning");
  const summary=warning
    ? warning.title
    : signals[0].title;

  let priority="Compare seu board com o Top 4 antes de tirar uma conclusão.";
  if(warning?.id==="contest") priority="Revise se a linha estava contestada cedo o bastante para justificar pivotar.";
  else if(warning?.id==="level-gap") priority="Revise economia e timing de nível; o snapshot final mostra um gap claro.";
  else if(warning?.id==="level-no-conversion") priority="Revise qualidade do board final: estrelas, itens e unidades importaram mais que o nível.";
  else if(warning?.id==="star-gap") priority="Revise se seu plano dependia de upgrades que não chegaram.";
  else if(warning?.id==="gold-left") priority="Revise o momento final de gasto; havia ouro sobrando no snapshot de eliminação.";

  return {
    summary,
    priority,
    signals:signals.slice(0,4),
    contested,
    closest,
    benchmarks:{
      yourLevel:you.level,
      top4Level:top4Level==null?null:+top4Level.toFixed(2),
      lobbyLevel:lobbyLevel==null?null:+lobbyLevel.toFixed(2),
      yourThreeStars:threeStars(you.units),
      top4ThreeStars:top4ThreeStars==null?null:+top4ThreeStars.toFixed(2),
      yourGold:you.goldLeft,
      lobbyGold:lobbyGold==null?null:+lobbyGold.toFixed(2),
    },
  };
}
