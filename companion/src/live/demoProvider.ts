import { OverlayFrame } from "./types";

function now(){
  return Date.now();
}

export const DEMO_FRAMES:OverlayFrame[]=[
  {
    id:"stable",
    label:"Estável",
    snapshot:{source:"demo",capturedAt:now(),stage:"3-2",hp:82,gold:42,level:6,streak:"W2"},
    decision:{
      state:"stable",
      tone:"good",
      confidence:"medium",
      boardStatus:"ESTÁVEL PARA O STAGE",
      boardScore:72,
      title:"Preserve economia e observe a lobby",
      actions:[
        "Não há necessidade clara de rolar agora.",
        "Complete frontline se aparecer upgrade natural.",
        "Scout antes do 3-5.",
      ],
      mainProblem:"Nenhum problema dominante",
      secondarySignals:["Economia saudável","Frontline suficiente","Carry ainda precisa de upgrade"],
      nextSpike:"Level 7 · 4-1 / 4-2",
    },
  },
  {
    id:"weak",
    label:"Fraco",
    snapshot:{source:"demo",capturedAt:now(),stage:"3-2",hp:61,gold:36,level:6,streak:"L3"},
    decision:{
      state:"weak",
      tone:"danger",
      confidence:"medium",
      boardStatus:"FRACO PARA O STAGE",
      boardScore:39,
      title:"Estabilize antes de continuar greedando",
      actions:[
        "Transforme pares em upgrades.",
        "Se perder forte de novo, gaste parte do ouro.",
        "Melhore frontline antes da transição completa.",
      ],
      mainProblem:"Frontline abaixo do necessário",
      secondarySignals:["2 pares sem upgrade","HP caindo rápido","Carry pronto, tanque atrasado"],
      nextSpike:"Estabilização · 10–20g",
    },
  },
  {
    id:"contested",
    label:"Contestado",
    snapshot:{source:"demo",capturedAt:now(),stage:"4-1",hp:54,gold:31,level:7,streak:"L1"},
    decision:{
      state:"contested",
      tone:"warning",
      confidence:"medium",
      boardStatus:"LINHA MUITO CONTESTADA",
      boardScore:58,
      title:"Pare antes de comprometer todo o ouro",
      actions:[
        "Dois rivais compartilham peças centrais.",
        "Compare sua rota alternativa.",
        "Mantenha duas saídas para os mesmos itens.",
      ],
      mainProblem:"Peças centrais divididas na lobby",
      secondarySignals:["2 rivais diretos","Carry disputado","Frontline compartilhada"],
      nextSpike:"Decisão de pivot · antes do rolldown",
    },
  },
  {
    id:"spike",
    label:"Spike",
    snapshot:{source:"demo",capturedAt:now(),stage:"4-2",hp:67,gold:18,level:8,streak:"W3"},
    decision:{
      state:"spike",
      tone:"good",
      confidence:"medium",
      boardStatus:"PICO DE FORÇA ATIVO",
      boardScore:86,
      title:"Consolide o board que já funciona",
      actions:[
        "Evite desmontar a estrutura atual.",
        "Busque upgrades específicos.",
        "Scout para ajustar posicionamento.",
      ],
      mainProblem:"Risco principal: over-roll",
      secondarySignals:["Board estabilizado","Economia baixa após spike","Cap vem de upgrades pontuais"],
      nextSpike:"Cap de board · upgrades + posição",
    },
  },
];

export function demoFrame(id:string){
  return DEMO_FRAMES.find(frame=>frame.id===id)||DEMO_FRAMES[0];
}
