import { TftMatch, TftMatchDetail, TftTrait, TftUnit } from "../api/tft";

type Participant=TftMatchDetail["match"]["participants"][number];
type Confidence="alta"|"média"|"inicial";

export type LobbyAutopsySignal={
  id:string;
  tone:"good"|"warning"|"neutral";
  title:string;
  body:string;
  evidence:string;
  strength:number;
  confidence:Confidence;
};

export type LobbyAutopsy={
  summary:string;
  priority:string;
  diagnosis:{
    title:string;
    body:string;
    confidence:Confidence;
    score:number;
    evidence:string[];
  };
  signals:LobbyAutopsySignal[];
  contested:Array<{
    characterId:string;
    opponents:number;
    copies:number;
    yourCopies:number;
    itemized:boolean;
  }>;
  closest:null|{
    placement:number;
    similarity:number;
    sharedUnits:string[];
    sharedTraits:string[];
    levelDelta:number;
    threeStarDelta:number;
    boardValueDelta:number;
    itemDelta:number;
  };
  benchmarks:{
    yourLevel:number;
    top4Level:number|null;
    lobbyLevel:number|null;
    yourThreeStars:number;
    top4ThreeStars:number|null;
    yourGold:number;
    lobbyGold:number|null;
    yourBoardValue:number;
    top4BoardValue:number|null;
    yourItems:number;
    top4Items:number|null;
    abovePlacement:number|null;
    aboveBoardValue:number|null;
    aboveItems:number|null;
    aboveLevel:number|null;
    aboveThreeStars:number|null;
  };
};

function avg(values:number[]){
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}

function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,value));
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

function copiesForTier(tier:number){
  return tier>=3?9:tier===2?3:1;
}

function unitCost(unit:TftUnit){
  return Math.max(1,Math.min(5,(Number(unit.rarity)||0)+1));
}

function estimatedBoardValue(units:TftUnit[]){
  return units.reduce(
    (sum,unit)=>sum+unitCost(unit)*copiesForTier(Math.max(1,Number(unit.tier)||1)),
    0,
  );
}

function itemCount(units:TftUnit[]){
  return units.reduce((sum,unit)=>sum+(unit.itemNames?.length||0),0);
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

function confidenceFor(strength:number,hasDirectComparison:boolean):Confidence{
  if(hasDirectComparison&&strength>=72) return "alta";
  if(strength>=52) return "média";
  return "inicial";
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
  const yourUnits=new Map(you.units.map(unit=>[unit.characterId,unit]));

  const contested=[...yourUnits.entries()].map(([characterId,yourUnit])=>{
    const enemyUnits=opponents
      .flatMap(participant=>participant.units)
      .filter(unit=>unit.characterId===characterId);

    return {
      characterId,
      opponents:opponents.filter(participant=>participant.units.some(unit=>unit.characterId===characterId)).length,
      copies:enemyUnits.reduce((sum,unit)=>sum+copiesForTier(unit.tier),0),
      yourCopies:copiesForTier(yourUnit.tier),
      itemized:(yourUnit.itemNames?.length||0)>=2,
    };
  })
    .filter(row=>row.opponents>0)
    .sort((a,b)=>
      Number(b.itemized)-Number(a.itemized)
      ||b.copies-a.copies
      ||b.opponents-a.opponents
    );

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
    boardValueDelta:estimatedBoardValue(closestRaw.participant.units)-estimatedBoardValue(you.units),
    itemDelta:itemCount(closestRaw.participant.units)-itemCount(you.units),
  } : null;

  const top4=participants.filter(participant=>participant.placement<=4);
  const top4Level=avg(top4.map(participant=>participant.level));
  const lobbyLevel=avg(participants.map(participant=>participant.level));
  const top4ThreeStars=avg(top4.map(participant=>threeStars(participant.units)));
  const lobbyGold=avg(participants.map(participant=>participant.goldLeft));
  const top4BoardValue=avg(top4.map(participant=>estimatedBoardValue(participant.units)));
  const top4Items=avg(top4.map(participant=>itemCount(participant.units)));

  const yourBoardValue=estimatedBoardValue(you.units);
  const yourItems=itemCount(you.units);
  const yourThreeStars=threeStars(you.units);
  const above=you.placement>1
    ? participants.find(participant=>participant.placement===you.placement-1)||null
    : participants.find(participant=>participant.placement===2)||null;

  const signals:LobbyAutopsySignal[]=[];

  const addSignal=(signal:Omit<LobbyAutopsySignal,"confidence">,direct=false)=>{
    signals.push({
      ...signal,
      confidence:confidenceFor(signal.strength,direct),
    });
  };

  if(you.placement>=5&&top4BoardValue!=null){
    const absoluteGap=top4BoardValue-yourBoardValue;
    const relativeGap=top4BoardValue>0?absoluteGap/top4BoardValue:0;
    if(absoluteGap>=6&&relativeGap>=.12){
      const strength=clamp(Math.round(58+relativeGap*90+Math.min(12,absoluteGap/2)));
      addSignal({
        id:"board-value-gap",
        tone:"warning",
        title:"Seu board final ficou abaixo do valor do Top 4",
        body:"O investimento estimado em custo e estrelas terminou abaixo da média dos boards que fecharam no Top 4.",
        evidence:"Você "+yourBoardValue+"g estimados · Top 4 "+top4BoardValue.toFixed(0)+"g",
        strength,
      },true);
    }
  }

  if(above){
    const aboveValue=estimatedBoardValue(above.units);
    const valueDelta=aboveValue-yourBoardValue;
    const aboveItems=itemCount(above.units);
    const itemDelta=aboveItems-yourItems;
    const levelDelta=above.level-you.level;
    const starDelta=threeStars(above.units)-yourThreeStars;
    const gaps=[
      valueDelta>=5 ? "board +"+valueDelta+"g" : "",
      itemDelta>=2 ? "+"+itemDelta+" itens" : "",
      levelDelta>=1 ? "+1 nível" : "",
      starDelta>=1 ? "+"+starDelta+" unidade(s) 3★" : "",
    ].filter(Boolean);

    if(gaps.length>=2&&above.placement<you.placement){
      const strength=clamp(55+gaps.length*9+Math.max(0,valueDelta)/3);
      addSignal({
        id:"above-gap",
        tone:"warning",
        title:"Quem ficou logo acima fechou um board mais completo",
        body:"A comparação com o "+above.placement+"º mostra vários gaps finais ao mesmo tempo.",
        evidence:gaps.join(" · "),
        strength,
      },true);
    }
  }

  const contestedCarries=contested.filter(row=>row.itemized);
  if(contestedCarries.length){
    const totalEnemyCopies=contestedCarries.reduce((sum,row)=>sum+row.copies,0);
    const maxOpponents=Math.max(...contestedCarries.map(row=>row.opponents));
    const strength=clamp(48+totalEnemyCopies*2+maxOpponents*7);
    addSignal({
      id:"carry-contest",
      tone:strength>=62?"warning":"neutral",
      title:"Uma unidade itemizada sua estava contestada",
      body:"Pelo menos uma unidade com 2+ itens também apareceu em boards adversários no snapshot final.",
      evidence:contestedCarries.length+" carry(s) contestado(s) · "+totalEnemyCopies+" cópias estimadas nos rivais",
      strength,
    },true);
  }else if(contested.length){
    const heavy=contested.filter(row=>row.opponents>=2||row.copies>=6);
    const strength=clamp(36+contested.length*4+heavy.length*8);
    addSignal({
      id:"contest",
      tone:heavy.length?"warning":"neutral",
      title:heavy.length?"Seu board teve contestação visível":"Parte do seu board apareceu em outros jogadores",
      body:heavy.length
        ? heavy.length+" unidade(s) tiveram contestação relevante no snapshot final."
        : contested.length+" unidade(s) também apareceram em outro board.",
      evidence:contested.slice(0,4).map(row=>row.opponents+" rival(is) · "+row.copies+" cópias").join(" | "),
      strength,
    },true);
  }

  if(top4Items!=null&&you.placement>=5&&yourItems<=top4Items-2){
    const gap=top4Items-yourItems;
    const strength=clamp(50+gap*8);
    addSignal({
      id:"item-gap",
      tone:"warning",
      title:"Seu board terminou com menos itens equipados",
      body:"O snapshot final mostra menos itens no seu board do que a média dos boards de Top 4.",
      evidence:"Você "+yourItems+" · Top 4 "+top4Items.toFixed(1),
      strength,
    },true);
  }

  if(top4Level!=null){
    const delta=you.level-top4Level;
    if(delta<=-.75){
      const strength=clamp(54+Math.abs(delta)*14);
      addSignal({
        id:"level-gap",
        tone:"warning",
        title:"Seu nível final ficou abaixo do Top 4",
        body:"Você terminou no nível "+you.level+", enquanto o Top 4 terminou em média no nível "+top4Level.toFixed(1)+".",
        evidence:"Diferença de "+Math.abs(delta).toFixed(1)+" nível",
        strength,
      },true);
    }else if(delta>=.75&&you.placement>=5){
      addSignal({
        id:"level-no-conversion",
        tone:"warning",
        title:"Nível alto não virou colocação",
        body:"Seu nível final ficou acima da média do Top 4, mas a colocação terminou fora dele.",
        evidence:"Você "+you.level+" · Top 4 "+top4Level.toFixed(1),
        strength:58,
      },true);
    }
  }

  if(top4ThreeStars!=null&&yourThreeStars+0.6<top4ThreeStars){
    const gap=top4ThreeStars-yourThreeStars;
    addSignal({
      id:"star-gap",
      tone:"warning",
      title:"Seu board final teve menos 3★ que o Top 4",
      body:"Seu board terminou com "+yourThreeStars+" unidade(s) 3★; o Top 4 teve média "+top4ThreeStars.toFixed(1)+".",
      evidence:"Gap de "+gap.toFixed(1)+" unidade(s) 3★",
      strength:clamp(50+gap*13),
    },true);
  }

  if(lobbyGold!=null&&you.placement>=5&&you.goldLeft>=10&&you.goldLeft>=lobbyGold+5){
    const gap=you.goldLeft-lobbyGold;
    addSignal({
      id:"gold-left",
      tone:"warning",
      title:"Você terminou com ouro acima da média da lobby",
      body:"Há recurso não convertido no snapshot de eliminação. Isso não prova que gastar antes era a decisão correta.",
      evidence:"Você "+you.goldLeft+"g · lobby "+lobbyGold.toFixed(1)+"g · gap +"+gap.toFixed(0)+"g",
      strength:clamp(52+gap*1.8),
    },true);
  }

  if(closest&&closest.placement<you.placement&&closest.similarity>=30){
    addSignal({
      id:"similar-better",
      tone:"neutral",
      title:"Um board parecido terminou melhor",
      body:"O "+closest.placement+"º teve estrutura "+closest.similarity+"% semelhante à sua no snapshot final.",
      evidence:"Board Δ "+(closest.boardValueDelta>0?"+":"")+closest.boardValueDelta+"g · itens Δ "+(closest.itemDelta>0?"+":"")+closest.itemDelta,
      strength:clamp(40+closest.similarity*.35),
    },true);
  }

  if(!signals.length){
    addSignal({
      id:"no-dominant",
      tone:"neutral",
      title:"Nenhum gap final domina a comparação",
      body:"Nível, valor de board, itens, estrelas e contestação não mostram um contraste grande o suficiente para explicar a colocação sozinhos.",
      evidence:"A próxima revisão útil depende de decisões por rodada que a Riot API não expõe neste snapshot.",
      strength:30,
    });
  }

  signals.sort((a,b)=>b.strength-a.strength);
  const primary=signals[0];

  const diagnosisConfidence:Confidence=
    primary.strength>=72&&primary.id!=="no-dominant"
      ?"alta"
      :primary.strength>=52
        ?"média"
        :"inicial";

  const diagnosisTitle=you.placement<=4
    ? "O maior contraste desta lobby: "+primary.title
    : primary.title;

  const diagnosisBody=you.placement<=4
    ? "Mesmo em uma boa colocação, este foi o contraste final mais forte encontrado para revisar."
    : "Este foi o maior gap observável no estado final da lobby. Trate como prioridade de review, não como causa comprovada.";

  let priority="Compare seu board com o Top 4 antes de tirar uma conclusão.";
  if(primary.id==="board-value-gap") priority="Revise onde seu ouro e suas compras deixaram de virar upgrades suficientes para acompanhar o Top 4.";
  else if(primary.id==="above-gap") priority="Compare diretamente com quem ficou logo acima e procure quando os gaps finais começaram a surgir.";
  else if(primary.id==="carry-contest") priority="Revise quando sua carry ficou contestada e se existia uma saída flexível antes do board final.";
  else if(primary.id==="contest") priority="Revise se a contestação apareceu cedo o bastante para justificar uma transição.";
  else if(primary.id==="item-gap") priority="Revise componentes, slams e distribuição: o snapshot final terminou atrás em itens equipados.";
  else if(primary.id==="level-gap") priority="Revise economia e timing de nível; o snapshot final mostra um gap claro.";
  else if(primary.id==="level-no-conversion") priority="Revise qualidade do board: chegar ao nível não foi suficiente para converter força.";
  else if(primary.id==="star-gap") priority="Revise se seu plano dependia de upgrades que não chegaram.";
  else if(primary.id==="gold-left") priority="Revise a última janela de gasto: havia ouro sobrando quando a partida terminou.";
  else if(primary.id==="similar-better") priority="Compare os dois boards parecidos e isole as diferenças de upgrades, itens e nível.";

  return {
    summary:primary.title,
    priority,
    diagnosis:{
      title:diagnosisTitle,
      body:diagnosisBody,
      confidence:diagnosisConfidence,
      score:primary.strength,
      evidence:signals.slice(0,3).map(signal=>signal.evidence),
    },
    signals:signals.slice(0,5),
    contested,
    closest,
    benchmarks:{
      yourLevel:you.level,
      top4Level:top4Level==null?null:+top4Level.toFixed(2),
      lobbyLevel:lobbyLevel==null?null:+lobbyLevel.toFixed(2),
      yourThreeStars,
      top4ThreeStars:top4ThreeStars==null?null:+top4ThreeStars.toFixed(2),
      yourGold:you.goldLeft,
      lobbyGold:lobbyGold==null?null:+lobbyGold.toFixed(2),
      yourBoardValue,
      top4BoardValue:top4BoardValue==null?null:+top4BoardValue.toFixed(2),
      yourItems,
      top4Items:top4Items==null?null:+top4Items.toFixed(2),
      abovePlacement:above?.placement??null,
      aboveBoardValue:above?estimatedBoardValue(above.units):null,
      aboveItems:above?itemCount(above.units):null,
      aboveLevel:above?.level??null,
      aboveThreeStars:above?threeStars(above.units):null,
    },
  };
}
