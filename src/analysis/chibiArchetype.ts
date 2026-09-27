import { TftMatch } from "../api/tft";
import { buildChibiDNA } from "./chibiInsights";
import { buildLeakMap } from "./chibiProduct";

export type ChibiArchetype = {
  id:"flex"|"leveler"|"reroll"|"stable"|"specialist"|"mixed";
  title:string;
  description:string;
  dimensions:{
    flexibility:number;
    stability:number;
    conversion:number;
    reroll:number;
    level:number;
  };
};

export type ChibiFocusBrief = {
  title:string;
  body:string;
  confidence:"alta"|"média"|"baixa";
  evidence:string;
  matchIds:string[];
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

function clamp(value:number){
  return Math.max(0,Math.min(100,Math.round(value)));
}

export function buildChibiArchetype(matches:TftMatch[]):ChibiArchetype{
  const dna=buildChibiDNA(matches);
  const valid=matches.filter(match=>match.placement>=1&&match.placement<=8);

  const rerollRate=valid.length
    ? valid.filter(match=>match.units.some(unit=>unit.tier>=3)).length/valid.length*100
    : 0;

  const averageLevel=avg(valid.map(match=>match.level))??0;
  const levelScore=clamp((averageLevel-6)*33.3);

  const dimensions={
    flexibility:dna.flexibility,
    stability:dna.stability,
    conversion:dna.conversion,
    reroll:clamp(rerollRate),
    level:levelScore,
  };

  if(valid.length<4){
    return {
      id:"mixed",
      title:"Perfil em formação",
      description:"Ainda há poucas partidas comparáveis para definir um padrão de jogo com segurança.",
      dimensions,
    };
  }

  if(dimensions.reroll>=60){
    return {
      id:"reroll",
      title:"Construtor de 3★",
      description:"Seu histórico recente termina com unidades 3★ em boa parte das partidas. O Chibi trata isso como preferência observada, não como qualidade da decisão.",
      dimensions,
    };
  }

  if(dimensions.level>=70&&dimensions.reroll<45){
    return {
      id:"leveler",
      title:"Escalador de nível",
      description:"Seus boards finais tendem a terminar em níveis altos e dependem menos de unidades 3★.",
      dimensions,
    };
  }

  if(dimensions.flexibility>=70){
    return {
      id:"flex",
      title:"Construtor flexível",
      description:"Sua amostra termina em várias identidades de board diferentes, com pouca concentração em uma única linha.",
      dimensions,
    };
  }

  if(dimensions.stability>=80){
    return {
      id:"stable",
      title:"Jogador de piso estável",
      description:"Sua principal característica recente é evitar 7º e 8º com frequência.",
      dimensions,
    };
  }

  if(dimensions.flexibility<45){
    return {
      id:"specialist",
      title:"Especialista de linha",
      description:"Seu histórico recente concentra mais partidas nas mesmas identidades principais de board.",
      dimensions,
    };
  }

  return {
    id:"mixed",
    title:"Perfil híbrido",
    description:"Nenhuma dimensão domina claramente a amostra. Seu padrão recente está distribuído entre estilos diferentes.",
    dimensions,
  };
}

export function buildFocusBrief(matches:TftMatch[]):ChibiFocusBrief{
  const leaks=buildLeakMap(matches);
  const primary=leaks.primary;

  if(!primary){
    return {
      title:"Continue coletando evidência",
      body:"A amostra ainda não tem um sinal dominante. Jogar mais partidas comparáveis melhora a leitura.",
      confidence:"baixa",
      evidence:matches.length+" partidas analisadas",
      matchIds:matches.map(match=>match.id),
    };
  }

  const prefix=primary.confidence==="baixa"
    ? "Sinal inicial"
    : primary.confidence==="média"
      ? "Sinal relevante"
      : "Sinal consistente";

  return {
    title:prefix+": "+primary.title,
    body:primary.description,
    confidence:primary.confidence,
    evidence:primary.evidence,
    matchIds:primary.matchIds,
  };
}
