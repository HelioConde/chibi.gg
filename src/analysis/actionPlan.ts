import { TftMatch } from "../api/tft";
import { buildLeakMap, buildSessionCoach } from "./chibiProduct";

export type ActionPlan={
  problem:{
    title:string;
    body:string;
    evidence:string;
    confidence:"alta"|"média"|"baixa";
    matchIds:string[];
  };
  action:{
    title:string;
    steps:string[];
    avoid:string;
  };
  success:{
    title:string;
    metric:string;
  };
};

export function buildActionPlan(matches:TftMatch[]):ActionPlan{
  const leaks=buildLeakMap(matches);
  const session=buildSessionCoach(matches);
  const primary=leaks.primary;

  if(!primary){
    return {
      problem:{
        title:"Ainda não há um erro dominante",
        body:"A amostra atual não sustenta um diagnóstico principal com segurança.",
        evidence:matches.length+" partidas analisadas",
        confidence:"baixa",
        matchIds:matches.map(match=>match.id),
      },
      action:{
        title:"Colete uma sessão comparável",
        steps:[
          "Jogue mais partidas no mesmo set e fila.",
          "Use o Journal quando uma decisão parecer importante.",
          "Volte e atualize o perfil para comparar a nova sessão.",
        ],
        avoid:"Evite mudar várias coisas ao mesmo tempo antes de termos um sinal claro.",
      },
      success:{
        title:"Meta imediata",
        metric:"Chegar a pelo menos 10 partidas comparáveis.",
      },
    };
  }

  if(primary.id==="conversion"){
    return {
      problem:{
        title:"Você chega ao Top 4, mas não está fechando partidas",
        body:"O sinal principal está na conversão: chegar ao Top 4 aconteceu, mas essas partidas não viraram 1º lugar na amostra.",
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:"Revise seus Top 4 antes da próxima fila",
        steps:[
          "Abra as partidas de Top 4 e compare board final, nível, estrelas e itens.",
          "Procure o que muda entre seus melhores Top 4 e os que pararam em 3º/4º.",
          "Nas próximas 5 partidas, marque no Journal quando sentir que o board já estava forte o bastante para jogar por 1º.",
        ],
        avoid:"Não force uma solução única só porque a conversão está baixa; a API não mostra o timing exato das decisões.",
      },
      success:{
        title:"Como saber se melhorou",
        metric:"Converter pelo menos 1 Top 4 em vitória nas próximas 5 partidas.",
      },
    };
  }

  if(primary.id==="bottom2"){
    return {
      problem:{
        title:"Seus 7º/8º estão puxando a amostra para baixo",
        body:"O principal vazamento observado está nas derrotas grandes. Reduzir Bottom 2 tende a estabilizar o resultado geral.",
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:"Proteja seu piso",
        steps:[
          "Revise primeiro as partidas de 7º/8º.",
          "Compare nível final, quantidade de unidades 2★/3★ e traits ativas com seus jogos de 4º–6º.",
          "Na próxima sessão, trate evitar uma derrota grande como prioridade de medição.",
        ],
        avoid:"Não use um highroll isolado como referência para corrigir partidas ruins.",
      },
      success:{
        title:"Como saber se melhorou",
        metric:"No máximo 1 Bottom 2 nas próximas 5 partidas.",
      },
    };
  }

  if(primary.id==="dominance"){
    return {
      problem:{
        title:"Seu histórico está concentrado demais em uma linha",
        body:"Uma mesma identidade de board aparece em uma parcela grande da amostra. Isso pode ser preferência ou pouca adaptação.",
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:"Teste uma segunda rota real",
        steps:[
          "Identifique a linha que mais se repetiu.",
          "Escolha uma segunda linha compatível com itens/traits que você já usa.",
          "Nas próximas 5 partidas, registre no Journal quando houve oportunidade real de pivotar.",
        ],
        avoid:"Não troque de comp só para parecer flexível; a segunda linha precisa surgir de um spot plausível.",
      },
      success:{
        title:"Como saber se melhorou",
        metric:"Terminar as próximas 5 partidas com pelo menos 2 identidades principais de board.",
      },
    };
  }

  if(primary.id==="level-conversion"){
    return {
      problem:{
        title:"Chegar ao nível não está convertendo em resultado",
        body:"Seus Bottom 4 terminaram em nível semelhante ou maior que seus Top 4. O nível final sozinho não está separando os bons resultados.",
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:"Olhe para qualidade do board, não só nível",
        steps:[
          "Compare seus Bottom 4 com Top 4 de nível parecido.",
          "Revise estrelas, itens completos e traits realmente ativas.",
          "Use o Counterfactual Lab para encontrar boards seus parecidos que terminaram melhor.",
        ],
        avoid:"Não conclua que subir de nível foi o erro; só sabemos que o nível final não diferenciou os resultados.",
      },
      success:{
        title:"Como saber se melhorou",
        metric:"Melhorar a colocação média do próximo bloco de 5 partidas.",
      },
    };
  }

  return {
    problem:{
      title:primary.title,
      body:primary.description,
      evidence:primary.evidence,
      confidence:primary.confidence,
      matchIds:primary.matchIds,
    },
    action:{
      title:session.focus,
      steps:[
        session.reason,
        "Compare as partidas relacionadas antes de mudar sua próxima sessão.",
        "Use o Journal para registrar o contexto que a Riot API não captura.",
      ],
      avoid:"Mude uma variável por vez para conseguir medir se houve diferença.",
    },
    success:{
      title:"Como saber se melhorou",
      metric:"Compare as próximas 5 partidas com esta amostra.",
    },
  };
}
