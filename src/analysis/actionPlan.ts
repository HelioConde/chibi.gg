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

type Translate=(key:string,vars?:Record<string,string|number>)=>string;

function interpolate(value:string,vars?:Record<string,string|number>){
  if(!vars)return value;
  return value.replace(/\{\{(\w+)\}\}/g,(_,key)=>Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):"{{"+key+"}}");
}

function translator(t?:Translate){
  return (key:string,fallback:string,vars?:Record<string,string|number>)=>
    t?t(key,vars):interpolate(fallback,vars);
}

export function buildActionPlan(matches:TftMatch[],t?:Translate):ActionPlan{
  const tr=translator(t);
  const leaks=buildLeakMap(matches);
  const session=buildSessionCoach(matches);
  const primary=leaks.primary;

  if(!primary){
    return {
      problem:{
        title:tr("action.none.title","Ainda não há um erro dominante"),
        body:tr("action.none.body","A amostra atual não sustenta um diagnóstico principal com segurança."),
        evidence:tr("action.matchesAnalyzed","{{count}} partidas analisadas",{count:matches.length}),
        confidence:"baixa",
        matchIds:matches.map(match=>match.id),
      },
      action:{
        title:tr("action.none.action","Colete uma sessão comparável"),
        steps:[
          tr("action.none.step1","Jogue mais partidas no mesmo set e fila."),
          tr("action.none.step2","Use o Journal quando uma decisão parecer importante."),
          tr("action.none.step3","Volte e atualize o perfil para comparar a nova sessão."),
        ],
        avoid:tr("action.none.avoid","Evite mudar várias coisas ao mesmo tempo antes de termos um sinal claro."),
      },
      success:{
        title:tr("action.immediate","Meta imediata"),
        metric:tr("action.none.metric","Chegar a pelo menos 10 partidas comparáveis."),
      },
    };
  }

  if(primary.id==="conversion"){
    return {
      problem:{
        title:tr("action.conversion.title","Você chega ao Top 4, mas não está fechando partidas"),
        body:tr("action.conversion.body","O sinal principal está na conversão: chegar ao Top 4 aconteceu, mas essas partidas não viraram 1º lugar na amostra."),
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:tr("action.conversion.action","Revise seus Top 4 antes da próxima fila"),
        steps:[
          tr("action.conversion.step1","Abra as partidas de Top 4 e compare board final, nível, estrelas e itens."),
          tr("action.conversion.step2","Procure o que muda entre seus melhores Top 4 e os que pararam em 3º/4º."),
          tr("action.conversion.step3","Nas próximas 5 partidas, marque no Journal quando sentir que o board já estava forte o bastante para jogar por 1º."),
        ],
        avoid:tr("action.conversion.avoid","Não force uma solução única só porque a conversão está baixa; a API não mostra o timing exato das decisões."),
      },
      success:{
        title:tr("action.success","Como saber se melhorou"),
        metric:tr("action.conversion.metric","Converter pelo menos 1 Top 4 em vitória nas próximas 5 partidas."),
      },
    };
  }

  if(primary.id==="bottom2"){
    return {
      problem:{
        title:tr("action.bottom.title","Seus 7º/8º estão puxando a amostra para baixo"),
        body:tr("action.bottom.body","O principal vazamento observado está nas derrotas grandes. Reduzir Bottom 2 tende a estabilizar o resultado geral."),
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:tr("action.bottom.action","Proteja seu piso"),
        steps:[
          tr("action.bottom.step1","Revise primeiro as partidas de 7º/8º."),
          tr("action.bottom.step2","Compare nível final, quantidade de unidades 2★/3★ e traits ativas com seus jogos de 4º–6º."),
          tr("action.bottom.step3","Na próxima sessão, trate evitar uma derrota grande como prioridade de medição."),
        ],
        avoid:tr("action.bottom.avoid","Não use um highroll isolado como referência para corrigir partidas ruins."),
      },
      success:{
        title:tr("action.success","Como saber se melhorou"),
        metric:tr("action.bottom.metric","No máximo 1 Bottom 2 nas próximas 5 partidas."),
      },
    };
  }

  if(primary.id==="dominance"){
    return {
      problem:{
        title:tr("action.dominance.title","Seu histórico está concentrado demais em uma linha"),
        body:tr("action.dominance.body","Uma mesma identidade de board aparece em uma parcela grande da amostra. Isso pode ser preferência ou pouca adaptação."),
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:tr("action.dominance.action","Teste uma segunda rota real"),
        steps:[
          tr("action.dominance.step1","Identifique a linha que mais se repetiu."),
          tr("action.dominance.step2","Escolha uma segunda linha compatível com itens/traits que você já usa."),
          tr("action.dominance.step3","Nas próximas 5 partidas, registre no Journal quando houve oportunidade real de pivotar."),
        ],
        avoid:tr("action.dominance.avoid","Não troque de comp só para parecer flexível; a segunda linha precisa surgir de um spot plausível."),
      },
      success:{
        title:tr("action.success","Como saber se melhorou"),
        metric:tr("action.dominance.metric","Terminar as próximas 5 partidas com pelo menos 2 identidades principais de board."),
      },
    };
  }

  if(primary.id==="level-conversion"){
    return {
      problem:{
        title:tr("action.level.title","Chegar ao nível não está convertendo em resultado"),
        body:tr("action.level.body","Seus Bottom 4 terminaram em nível semelhante ou maior que seus Top 4. O nível final sozinho não está separando os bons resultados."),
        evidence:primary.evidence,
        confidence:primary.confidence,
        matchIds:primary.matchIds,
      },
      action:{
        title:tr("action.level.action","Olhe para qualidade do board, não só nível"),
        steps:[
          tr("action.level.step1","Compare seus Bottom 4 com Top 4 de nível parecido."),
          tr("action.level.step2","Revise estrelas, itens completos e traits realmente ativas."),
          tr("action.level.step3","Use o Counterfactual Lab para encontrar boards seus parecidos que terminaram melhor."),
        ],
        avoid:tr("action.level.avoid","Não conclua que subir de nível foi o erro; só sabemos que o nível final não diferenciou os resultados."),
      },
      success:{
        title:tr("action.success","Como saber se melhorou"),
        metric:tr("action.level.metric","Melhorar a colocação média do próximo bloco de 5 partidas."),
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
        tr("action.default.step2","Compare as partidas relacionadas antes de mudar sua próxima sessão."),
        tr("action.default.step3","Use o Journal para registrar o contexto que a Riot API não captura."),
      ],
      avoid:tr("action.default.avoid","Mude uma variável por vez para conseguir medir se houve diferença."),
    },
    success:{
      title:tr("action.success","Como saber se melhorou"),
      metric:tr("action.default.metric","Compare as próximas 5 partidas com esta amostra."),
    },
  };
}
