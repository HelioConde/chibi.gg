import { LiveSnapshot, OverlayDecision, OverlayFrame } from "./types";

function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,value));
}

function losing(streak?:string){
  return /^L/i.test(String(streak||""));
}

export function analyzeSnapshot(snapshot:LiveSnapshot):OverlayDecision{
  const hp=Number(snapshot.hp??100);
  const gold=Number(snapshot.gold??0);
  const level=Number(snapshot.level??1);
  const strength=clamp(Number(snapshot.boardStrength??60));
  const contestants=Math.max(0,Number(snapshot.contestants??0));
  const pairs=Math.max(0,Number(snapshot.upgradePairs??0));
  const frontlineReady=snapshot.frontlineReady!==false;

  if(contestants>=2){
    return {
      state:"contested",
      tone:"warning",
      confidence:"medium",
      boardStatus:"LINHA MUITO CONTESTADA",
      boardScore:strength,
      title:"Pare antes de comprometer todo o ouro",
      actions:[
        contestants+" rivais aparecem na mesma rota.",
        "Compare pelo menos uma alternativa que use seus itens atuais.",
        gold>=30?"Preserve parte do ouro até decidir a rota.":"Evite rolar fundo sem uma saída clara.",
      ],
      mainProblem:"Peças centrais divididas na lobby",
      secondarySignals:[
        contestants+" rivais diretos",
        pairs?pairs+" pares aguardando upgrade":"Poucos upgrades imediatos informados",
        frontlineReady?"Frontline ainda funcional":"Frontline também precisa de atenção",
      ],
      nextSpike:"Decisão de rota · antes do próximo rolldown",
    };
  }

  if(strength<50 || (hp<=60&&losing(snapshot.streak))){
    return {
      state:"weak",
      tone:"danger",
      confidence:"medium",
      boardStatus:"FRACO PARA O STAGE",
      boardScore:strength,
      title:"Estabilize antes de continuar greedando",
      actions:[
        pairs>0?"Converta "+pairs+" par(es) em upgrades se a loja permitir.":"Procure upgrades de baixo custo antes de trocar toda a estrutura.",
        gold>=30?"Você tem margem para gastar parte da economia.":"Evite uma transição cara sem melhorar o board imediatamente.",
        !frontlineReady?"Frontline é a prioridade mais clara agora.":"Proteja HP antes de buscar teto de board.",
      ],
      mainProblem:!frontlineReady?"Frontline abaixo do necessário":"Força atual abaixo do esperado",
      secondarySignals:[
        "Força informada: "+strength+"/100",
        hp+" HP"+(losing(snapshot.streak)?" em sequência de derrota":""),
        gold+"g disponíveis",
      ],
      nextSpike:gold>=30?"Estabilização · gasto controlado":"Próximo upgrade natural",
    };
  }

  if(strength>=78 && level>=7){
    return {
      state:"spike",
      tone:"good",
      confidence:"medium",
      boardStatus:"PICO DE FORÇA ATIVO",
      boardScore:strength,
      title:"Consolide o board que já está funcionando",
      actions:[
        "Evite desmontar a estrutura apenas para seguir uma comp teórica.",
        pairs>0?"Priorize os "+pairs+" par(es) que aumentam qualidade real.":"Busque upgrades específicos, não volume de mudanças.",
        "Use scouting para ajustar posicionamento antes de gastar mais.",
      ],
      mainProblem:"Risco principal: gastar além do necessário",
      secondarySignals:[
        "Força informada: "+strength+"/100",
        "Nível "+level,
        contestants===0?"Linha sem contestação informada":"Contestação baixa",
      ],
      nextSpike:"Cap de board · upgrades + posicionamento",
    };
  }

  return {
    state:"stable",
    tone:"good",
    confidence:"low",
    boardStatus:"ESTÁVEL PARA O STAGE",
    boardScore:strength,
    title:"Preserve opções e observe a próxima luta",
    actions:[
      gold>=30?"Sua economia permite esperar mais informação.":"Evite gasto automático sem um motivo claro.",
      !frontlineReady?"Melhore frontline se aparecer upgrade natural.":"Mantenha a estrutura atual enquanto ela segura HP.",
      "Scout antes da próxima janela de decisão.",
    ],
    mainProblem:"Nenhum problema dominante",
    secondarySignals:[
      "Força informada: "+strength+"/100",
      hp+" HP",
      contestants+" rival(is) direto(s)",
    ],
    nextSpike:level<7?"Próximo nível":"Próximo upgrade relevante",
  };
}

export function frameFromSnapshot(snapshot:LiveSnapshot):OverlayFrame{
  const decision=analyzeSnapshot(snapshot);
  return {
    id:decision.state,
    label:"Manual",
    snapshot:{...snapshot,capturedAt:Date.now()},
    decision,
  };
}
