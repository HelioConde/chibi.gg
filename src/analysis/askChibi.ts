import { TftMatch } from "../api/tft";
import { buildActionPlan } from "./actionPlan";
import { buildChibiArchetype } from "./chibiArchetype";
import { buildStyleShift } from "./styleShift";
import { buildLeakMap, buildPersonalMeta } from "./chibiProduct";
import { buildChibiDNA } from "./chibiInsights";
import { buildReviewQueue } from "./reviewQueue";
import { buildJournalBehaviorSignal } from "../journal";
import { getDueLessons, getLessons } from "../lessons";
import { getActiveSession, sessionProgress } from "../sessionMode";

export type AskChibiConfidence="alta"|"média"|"baixa";

export type AskChibiAnswer={
  intent:string;
  title:string;
  body:string;
  bullets:string[];
  evidence:string;
  confidence:AskChibiConfidence;
  matchIds:string[];
  followups:string[];
};

function normalize(value:string){
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s#]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function coreTrait(match:TftMatch){
  return match.traits
    .filter(t=>t.numUnits>0&&(t.style>0||t.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function repeatedLineSignal(matches:TftMatch[]){
  const counts=new Map<string,TftMatch[]>();
  for(const match of matches){
    const id=coreTrait(match);
    if(!id) continue;
    const list=counts.get(id)||[];
    list.push(match);
    counts.set(id,list);
  }
  const dominant=[...counts.entries()].sort((a,b)=>b[1].length-a[1].length)[0]||null;
  if(!dominant) return null;
  return {
    id:dominant[0],
    games:dominant[1].length,
    share:matches.length?Math.round(dominant[1].length/matches.length*100):0,
    matchIds:dominant[1].map(match=>match.id),
  };
}

function confidenceBySample(matches:number):AskChibiConfidence{
  if(matches>=20) return "alta";
  if(matches>=10) return "média";
  return "baixa";
}

export function answerChibiQuestion(question:string,matches:TftMatch[],playerKey=""):AskChibiAnswer{
  const q=normalize(question);
  const action=buildActionPlan(matches);
  const dna=buildChibiDNA(matches);
  const archetype=buildChibiArchetype(matches);
  const shift=buildStyleShift(matches);
  const leaks=buildLeakMap(matches);
  const personal=buildPersonalMeta(matches);
  const dominant=repeatedLineSignal(matches);
  const journalSignal=buildJournalBehaviorSignal(matches);
  const dueLessons=playerKey?getDueLessons(playerKey):[];
  const lessons=playerKey?getLessons(playerKey):[];
  const activeSession=playerKey?getActiveSession(playerKey):null;
  const activeSessionProgress=activeSession?sessionProgress(activeSession,matches):null;
  const allIds=matches.map(match=>match.id);

  const asksWhy=q.includes("por que")||q.includes("porque")||q.includes("perdendo")||q.includes("perco")||q.includes("perdi")||q.includes("errado")||q.includes("erro");
  const asksForce=q.includes("forcando")||q.includes("forcar")||q.includes("forcei")||q.includes("forco")||q.includes("mesma comp")||q.includes("mesma linha");
  const asksNow=q.includes("fazer agora")||q.includes("o que fazer")||q.includes("proxima")||q.includes("melhorar")||q.includes("treinar");
  const asksChanged=q.includes("mudou")||q.includes("mudanca")||q.includes("ultimas")||q.includes("recentes")||q.includes("piorando")||q.includes("melhorando");
  const asksWorking=q.includes("funcionando")||q.includes("funciona")||q.includes("melhor linha")||q.includes("melhor comp")||q.includes("bom em")||q.includes("melhor para mim");
  const asksStyle=q.includes("estilo")||q.includes("tipo de jogador")||q.includes("como eu jogo");
  const asksTop4=q.includes("top 4")||q.includes("top4")||q.includes("converter")||q.includes("conversao");
  const asksBottom=q.includes("bottom")||q.includes("7")||q.includes("8")||q.includes("setimo")||q.includes("oitavo");
  const asksReview=q.includes("qual partida")||q.includes("que partida")||q.includes("revisar primeiro")||q.includes("devo revisar")||q.includes("review queue")||q.includes("fila de revisao");
  const asksJournal=q.includes("journal")||q.includes("repetindo")||q.includes("repito")||q.includes("habito")||q.includes("comportamento")||q.includes("anotei")||q.includes("registrei");
  const asksLesson=q.includes("licao")||q.includes("aprendi")||q.includes("lembrar")||q.includes("relembrar");
  const asksSession=q.includes("sessao")||q.includes("experimento")||q.includes("3 partidas")||q.includes("tres partidas");

  if(asksJournal){
    if(!journalSignal){
      return {
        intent:"journal",
        title:"Seu Journal ainda não mostra um comportamento recorrente",
        body:"Preciso de pelo menos duas marcações comparáveis antes de transformar percepção em padrão.",
        bullets:[
          "Use o Quick Review Checklist depois das partidas.",
          "Marque também partidas boas para evitar viés de lembrar erros só quando perde.",
        ],
        evidence:"Sem padrão auto-relatado forte nesta amostra",
        confidence:"baixa",
        matchIds:[],
        followups:["Qual partida devo revisar?","O que devo fazer agora?"],
      };
    }

    return {
      intent:"journal",
      title:"Você está repetindo: "+journalSignal.label,
      body:journalSignal.tone==="warning"
        ? "Esse comportamento apareceu repetidamente nas partidas que você marcou e ficou concentrado em resultados piores."
        : "Esse comportamento apareceu repetidamente nas suas anotações e ficou associado a resultados melhores nesta amostra.",
      bullets:[
        journalSignal.evidence,
        "Pergunta para a próxima sessão: "+journalSignal.question,
        "Confiança do padrão: "+journalSignal.confidence+".",
      ],
      evidence:journalSignal.evidence,
      confidence:journalSignal.confidence==="inicial"?"baixa":journalSignal.confidence,
      matchIds:journalSignal.matchIds,
      followups:["O que devo fazer agora?","Qual lição devo revisar?","Qual partida devo revisar?"],
    };
  }

  if(asksLesson){
    const lesson=dueLessons[0]||lessons[0]||null;
    if(!lesson){
      return {
        intent:"lesson",
        title:"Você ainda não salvou uma Chibi Lesson",
        body:"Depois de revisar uma partida, escreva no Journal o que aprendeu e use “Salvar como lição”.",
        bullets:[
          "A lição fica ligada à partida de origem.",
          "O Chibi volta a mostrá-la em intervalos crescentes.",
        ],
        evidence:"0 lições disponíveis",
        confidence:"baixa",
        matchIds:[],
        followups:["Qual partida devo revisar?","O que eu estou repetindo?"],
      };
    }

    return {
      intent:"lesson",
      title:dueLessons[0]?"Esta lição está pronta para revisão":"Sua lição mais recente",
      body:lesson.text,
      bullets:[
        lesson.reviewCount===0?"Você ainda não confirmou esta lição.":lesson.reviewCount+" revisão"+(lesson.reviewCount===1?"":"ões")+" registrada(s).",
        dueLessons[0]?"Ela está na fila de revisão agora.":"Nenhuma lição está vencida; esta é apenas a mais recente.",
      ],
      evidence:"Chibi Lesson ligada a 1 partida",
      confidence:"média",
      matchIds:[lesson.matchId],
      followups:["Abrir a partida dessa lição","O que eu estou repetindo?","Qual minha sessão atual?"],
    };
  }

  if(asksSession){
    if(!activeSession){
      return {
        intent:"session",
        title:"Você não tem uma Chibi Session ativa",
        body:"Na aba Agora, inicie um experimento de 3 partidas para testar uma única mudança por vez.",
        bullets:[
          "O foco é definido antes da fila.",
          "O Chibi compara as 3 partidas com o bloco anterior.",
          "O Journal pode acrescentar uma pergunta comportamental.",
        ],
        evidence:"Nenhuma sessão ativa neste navegador",
        confidence:"baixa",
        matchIds:[],
        followups:["O que devo fazer agora?","O que eu estou repetindo?"],
      };
    }

    return {
      intent:"session",
      title:activeSession.focusTitle,
      body:"Sua Chibi Session está em "+(activeSessionProgress?.played||0)+"/"+activeSession.targetGames+" partidas.",
      bullets:[
        ...activeSession.focusSteps.slice(0,2),
        activeSession.journalPrompt?"Pergunta do Journal: "+activeSession.journalPrompt:activeSession.successMetric,
      ],
      evidence:activeSessionProgress?.detail||activeSession.description,
      confidence:"média",
      matchIds:activeSessionProgress?.matchIds||[],
      followups:["Como saber se melhorei?","Qual lição devo revisar?","Qual partida devo revisar?"],
    };
  }

  if(asksReview){
    const queue=buildReviewQueue(matches);
    const next=queue[0];

    if(!next){
      return {
        intent:"review",
        title:"Ainda não há uma partida clara para priorizar",
        body:"Preciso de mais partidas comparáveis para montar uma fila de revisão útil.",
        bullets:["Carregue mais histórico no mesmo contexto.","Depois eu separo problema, comparação e referência."],
        evidence:matches.length+" partidas disponíveis",
        confidence:"baixa",
        matchIds:[],
        followups:["Por que estou perdendo?","O que devo fazer agora?"],
      };
    }

    return {
      intent:"review",
      title:"Revise primeiro o "+next.placement+"º lugar",
      body:next.reason,
      bullets:[
        next.evidence,
        queue[1]?"Depois compare com: "+queue[1].placement+"º lugar · "+queue[1].reason:"Depois escolha outra partida comparável.",
        queue[2]?"Use como referência: "+queue[2].placement+"º lugar · "+queue[2].reason:"Procure uma partida melhor como referência.",
      ],
      evidence:"Review Queue · "+queue.length+" partidas priorizadas",
      confidence:enoughSample?confidenceBySample(matches.length):"baixa",
      matchIds:[next.matchId],
      followups:["Por que essa partida primeiro?","O que devo fazer agora?","Estou forçando comp?"],
    };
  }

  if(asksForce){
    if(!dominant||dominant.games<2){
      return {
        intent:"force",
        title:"Não há evidência suficiente de que você esteja forçando uma linha",
        body:"Seu histórico carregado não mostra concentração forte o bastante em uma mesma identidade de board.",
        bullets:[
          "O Chibi precisa ver repetição real na amostra antes de chamar isso de dependência.",
          "Se você sente que está forçando mesmo assim, marque isso no Journal para cruzarmos percepção com resultado.",
        ],
        evidence:matches.length+" partidas analisadas",
        confidence:"baixa",
        matchIds:allIds,
        followups:["O que está me punindo?","Qual linha funciona melhor para mim?"],
      };
    }

    const enoughSample=matches.length>=8;
    const strong=enoughSample&&dominant.share>=45;
    return {
      intent:"force",
      title:!enoughSample
        ?"Amostra inicial: existe repetição, mas ainda não dá para chamar de padrão"
        :strong
          ?"Existe sinal de concentração em uma mesma linha"
          :"Há repetição, mas ainda não dá para chamar de força excessiva",
      body:!enoughSample
        ? "A mesma identidade apareceu em "+dominant.games+" de "+matches.length+" partidas. Com tão poucos jogos, isso pode ser só uma sequência curta."
        :strong
          ? "Sua linha principal aparece em "+dominant.share+"% das partidas desta amostra. Isso pode ser preferência legítima ou dependência; a API não mostra se a decisão foi tomada cedo demais."
          : "A linha mais repetida aparece em "+dominant.share+"% da amostra, abaixo de um nível que eu trataria como sinal forte.",
      bullets:[
        dominant.games+" partidas compartilham a mesma identidade principal de board.",
        strong?"Revise se houve spots reais para pivotar nas partidas relacionadas.":"Continue observando antes de mudar seu estilo.",
      ],
      evidence:dominant.games+" de "+matches.length+" partidas · "+dominant.share+"%",
      confidence:confidenceBySample(matches.length),
      matchIds:dominant.matchIds,
      followups:["O que devo fazer agora?","Mostre o que está funcionando."],
    };
  }

  if(asksChanged){
    if(!shift){
      return {
        intent:"changed",
        title:"Ainda não há dois blocos comparáveis suficientes",
        body:"Preciso de pelo menos 6 partidas comparáveis para dizer o que mudou sem inventar uma tendência.",
        bullets:["Carregue mais histórico no mesmo set e fila.","Depois eu comparo dois blocos do mesmo tamanho."],
        evidence:matches.length+" partidas disponíveis",
        confidence:"baixa",
        matchIds:allIds,
        followups:["O que está me punindo?","Como eu jogo?"],
      };
    }

    const changes=[
      {label:"flexibilidade",value:shift.deltas.flexibility},
      {label:"estabilidade",value:shift.deltas.stability},
      {label:"boards com 3★",value:shift.deltas.rerollRate},
    ].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
    const biggest=changes[0];

    return {
      intent:"changed",
      title:"A maior mudança recente está em "+biggest.label,
      body:"Comparando "+shift.window+" partidas recentes com "+shift.window+" anteriores, o delta foi "+(biggest.value>0?"+":"")+biggest.value+" pontos.",
      bullets:[
        "Colocação média: "+(shift.previous.avgPlacement??"—")+" → "+(shift.recent.avgPlacement??"—"),
        "Flexibilidade: "+shift.previous.flexibility+"% → "+shift.recent.flexibility+"%",
        "Estabilidade: "+shift.previous.stability+"% → "+shift.recent.stability+"%",
      ],
      evidence:(shift.window*2)+" partidas em dois blocos iguais",
      confidence:shift.confidence,
      matchIds:matches.slice(0,shift.window*2).map(match=>match.id),
      followups:["Isso está me ajudando ou atrapalhando?","O que devo fazer agora?"],
    };
  }

  if(asksWorking){
    const best=personal[0];
    if(!best){
      return {
        intent:"working",
        title:"Ainda não há uma linha repetida o bastante para chamar de padrão positivo",
        body:"Seu histórico está diversificado ou pequeno demais para apontar uma linha pessoal com segurança.",
        bullets:[
          "Isso não significa que nada esteja funcionando.",
          "Significa que eu ainda não tenho repetição suficiente para separar sinal de acaso.",
        ],
        evidence:matches.length+" partidas analisadas",
        confidence:"baixa",
        matchIds:allIds,
        followups:["Como eu jogo?","O que está me punindo?"],
      };
    }

    const enoughSample=matches.length>=8;
    return {
      intent:"working",
      title:enoughSample
        ?"Sua melhor linha repetida nesta amostra tem média "+best.avgPlacement
        :"Uma linha se repetiu nesta amostra inicial",
      body:enoughSample
        ?"Ela aparece em "+best.games+" partidas, com Top 4 em "+best.top4Rate+"%. Eu trataria isso como referência pessoal, não como ordem para forçar."
        :"Ela apareceu em "+best.games+" de "+matches.length+" partidas. Ainda é cedo para chamar isso de sua melhor linha com segurança.",
      bullets:[
        "Score pessoal: "+best.fitScore+"/100.",
        "Confiança: "+best.confidence+".",
        best.firsts+" vitória(s) nessa linha.",
      ],
      evidence:best.games+" partidas relacionadas",
      confidence:best.confidence,
      matchIds:best.matchIds,
      followups:["Estou forçando comp?","O que devo fazer agora?"],
    };
  }

  if(asksStyle){
    const enoughSample=matches.length>=8;
    return {
      intent:"style",
      title:enoughSample?"Seu arquétipo atual é: "+archetype.title:"Amostra inicial do seu estilo: "+archetype.title,
      body:enoughSample
        ?archetype.description
        :"Com "+matches.length+" partidas, este arquétipo é só uma leitura provisória. "+archetype.description,
      bullets:[
        "Flexibilidade: "+archetype.dimensions.flexibility+"%.",
        "Estabilidade: "+archetype.dimensions.stability+"%.",
        "Boards com 3★: "+archetype.dimensions.reroll+"%.",
      ],
      evidence:matches.length+" partidas no contexto atual",
      confidence:confidenceBySample(matches.length),
      matchIds:allIds,
      followups:["O que mudou recentemente?","Qual linha funciona melhor para mim?"],
    };
  }

  if(asksTop4){
    const top4=matches.filter(match=>match.placement<=4);
    const wins=matches.filter(match=>match.placement===1);
    const enoughSample=matches.length>=8;

    if(!enoughSample){
      return {
        intent:"top4",
        title:top4.length?"Amostra inicial de Top 4":"Ainda não há Top 4 suficiente para analisar",
        body:top4.length
          ? "Você teve "+top4.length+" Top 4 em "+matches.length+" partidas carregadas. Ainda é cedo para tratar a ausência ou presença de vitórias como um padrão de conversão."
          : "Carregue mais partidas comparáveis antes de avaliar conversão.",
        bullets:[
          wins.length+" vitória(s) em "+top4.length+" Top 4.",
          "A Riot mostra o snapshot final, mas não o timing completo de decisões que levou até a colocação.",
        ],
        evidence:top4.length+" Top 4 em "+matches.length+" partidas",
        confidence:"baixa",
        matchIds:top4.map(match=>match.id),
        followups:["Qual partida devo revisar?","O que mudou recentemente?"],
      };
    }

    return {
      intent:"top4",
      title:wins.length===0&&top4.length>=2?"Seus Top 4 ainda não converteram em vitória nesta amostra":"Sua conversão precisa ser lida com contexto",
      body:top4.length
        ? "Você teve "+top4.length+" Top 4 e "+wins.length+" vitória(s) nesta amostra."
        : "Ainda não há Top 4 suficiente nesta amostra para analisar conversão.",
      bullets:[
        top4.length?"Conversão observada: "+Math.round(wins.length/top4.length*100)+"%.":"Sem base para calcular conversão.",
        "A API mostra o board final, mas não mostra o timing completo das decisões que levaram até ele.",
      ],
      evidence:top4.length+" partidas de Top 4 em "+matches.length+" jogos",
      confidence:top4.length>=6?"média":"baixa",
      matchIds:top4.map(match=>match.id),
      followups:["O que devo revisar nos Top 4?","O que está funcionando?"],
    };
  }

  if(asksBottom){
    const bottom=matches.filter(match=>match.placement>=7);
    const enoughSample=matches.length>=6;
    return {
      intent:"bottom",
      title:bottom.length
        ? enoughSample
          ?"Seus Bottom 2 merecem revisão direta"
          :"Há Bottom 2 nesta amostra inicial"
        :"Bottom 2 não é o principal sinal desta amostra",
      body:bottom.length
        ? bottom.length+" de "+matches.length+" partidas terminaram em 7º/8º."
        : "Você não teve 7º/8º nas partidas carregadas deste contexto.",
      bullets:[
        bottom.length
          ? enoughSample
            ?"Comece comparando nível, estrelas e traits finais dessas derrotas com 4º–6º."
            :"Revise essas partidas, mas não trate a frequência como padrão ainda."
          :"Procure outro sinal no Action Center.",
        "O Lobby Autopsy pode mostrar contestação e diferenças observáveis em cada derrota.",
      ],
      evidence:bottom.length+" Bottom 2 em "+matches.length+" partidas",
      confidence:enoughSample?confidenceBySample(matches.length):"baixa",
      matchIds:bottom.length?bottom.map(match=>match.id):allIds,
      followups:["Por que estou perdendo?","O que devo fazer agora?"],
    };
  }

  if(asksNow){
    if(matches.length<8){
      return {
        intent:"now",
        title:"Amostra inicial: revise antes de mudar seu jogo",
        body:"Com "+matches.length+" partidas, o melhor próximo passo é revisar exemplos concretos e coletar um bloco comparável antes de transformar variação em diagnóstico.",
        bullets:[
          "Abra primeiro uma partida priorizada pela Review Queue.",
          "Mantenha o próximo bloco no mesmo set e fila para aumentar a comparabilidade.",
          "Use o Journal para registrar contexto que a Riot API não captura.",
        ],
        evidence:matches.length+" partidas no contexto atual",
        confidence:"baixa",
        matchIds:allIds,
        followups:["Qual partida devo revisar?","O que mudou recentemente?"],
      };
    }

    return {
      intent:"now",
      title:action.action.title,
      body:action.action.steps[0]||action.problem.body,
      bullets:action.action.steps.slice(1).concat(["Evite: "+action.action.avoid]),
      evidence:action.problem.evidence,
      confidence:action.problem.confidence,
      matchIds:action.problem.matchIds,
      followups:["Por que esse é o foco?","Como saber se melhorei?"],
    };
  }

  if(asksWhy||q.length>0){
    if(matches.length<8){
      return {
        intent:"why",
        title:"Ainda não há evidência suficiente para apontar uma causa principal",
        body:"Tenho "+matches.length+" partidas neste contexto. Posso mostrar diferenças observáveis entre elas, mas não chamar uma variação curta de causa ou padrão.",
        bullets:[
          "Use a Review Queue para abrir a partida mais útil primeiro.",
          "Compare board final, nível, estrelas, traits e itens entre resultados próximos.",
        ],
        evidence:matches.length+" partidas no contexto atual",
        confidence:"baixa",
        matchIds:allIds,
        followups:["Qual partida devo revisar?","O que mudou recentemente?","Estou forçando comp?"],
      };
    }

    return {
      intent:"why",
      title:action.problem.title,
      body:action.problem.body,
      bullets:[
        "Primeira ação: "+action.action.title+".",
        "Meta de validação: "+action.success.metric,
      ],
      evidence:action.problem.evidence,
      confidence:action.problem.confidence,
      matchIds:action.problem.matchIds,
      followups:["O que devo fazer agora?","Estou forçando comp?","O que mudou recentemente?"],
    };
  }

  return {
    intent:"help",
    title:"Pergunte sobre o seu próprio jogo",
    body:"Eu respondo usando somente as partidas carregadas e as análises do Chibi.",
    bullets:[
      "Por que estou perdendo?",
      "Estou forçando comp?",
      "O que devo fazer agora?",
      "O que mudou nas últimas partidas?",
    ],
    evidence:matches.length+" partidas disponíveis",
    confidence:"baixa",
    matchIds:[],
    followups:["Por que estou perdendo?","O que devo fazer agora?","Como eu jogo?"],
  };
}
