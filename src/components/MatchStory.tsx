import { useMemo } from "react";
import { TftMatch, TftMatchDetail } from "../api/tft";

type Props={
  target:TftMatch;
  detail:TftMatchDetail;
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

function threeStars(match:TftMatch){
  return match.units.filter(unit=>unit.tier>=3).length;
}

export default function MatchStory({target,detail}:Props){
  const story=useMemo(()=>{
    const lobby=detail.match.participants||[];
    const top4=lobby.filter(player=>player.placement<=4);
    const bottom4=lobby.filter(player=>player.placement>=5);
    const top4Level=avg(top4.map(player=>player.level));
    const bottom4Level=avg(bottom4.map(player=>player.level));
    const top4Gold=avg(top4.map(player=>player.goldLeft));
    const own3=threeStars(target);

    let resultTitle="Partida de meio da lobby";
    let resultBody="O resultado terminou entre 5º e 6º. É uma boa partida para entender onde o board deixou de acompanhar a pressão da lobby.";
    if(target.placement===1){
      resultTitle="Vitória convertida";
      resultBody="Use esta partida como referência do que estava presente quando seu board fechou a lobby.";
    }else if(target.placement<=4){
      resultTitle="Top 4 conquistado";
      resultBody="A partida chegou ao Top 4. O principal valor da revisão é entender o que separou esse board de uma vitória.";
    }else if(target.placement>=7){
      resultTitle="Bottom 2 — revisar primeiro";
      resultBody="Esta partida aumentou bastante a variância da sessão e merece prioridade na revisão.";
    }

    const working:string[]=[];
    if(target.placement<=4) working.push("O board terminou dentro do Top 4.");
    if(own3>0) working.push(own3+" unidade(s) 3★ chegaram ao board final.");
    if(top4Level!=null&&target.level>=top4Level) working.push("Seu nível final ficou alinhado ou acima da média do Top 4.");
    if(target.damageToPlayers>0) working.push(target.damageToPlayers+" de dano aos jogadores ao longo da partida.");
    if(!working.length) working.push("O board chegou até o fim da partida com nível "+target.level+" e estrutura completa o suficiente para ser comparada.");

    const punished:string[]=[];
    if(target.placement>=7) punished.push("O resultado terminou em Bottom 2.");
    if(target.goldLeft>=10&&target.placement>=5) punished.push("Você terminou com "+target.goldLeft+"g sem converter o resultado.");
    if(top4Level!=null&&target.placement>=5&&target.level>=top4Level) punished.push("Chegar ao nível não foi suficiente para acompanhar os boards de Top 4.");
    if(own3===0&&target.placement>=5) punished.push("O board final não terminou com nenhuma unidade 3★.");
    if(!punished.length){
      if(target.placement<=4&&target.placement>1) punished.push("O ponto de investigação é a conversão do Top 4 em vitória.");
      else punished.push("Nenhum sinal isolado explica o resultado; compare composição, contestação e qualidade final.");
    }

    let review="Comece pelo Lobby Autopsy e compare sua estrutura final com os boards que terminaram acima.";
    if(target.goldLeft>=10&&target.placement>=5){
      review="Revise primeiro se havia uma janela segura para transformar parte do ouro final em força de board.";
    }else if(target.placement<=4&&target.placement>1){
      review="Compare os boards de 1º–3º e procure diferenças observáveis de nível, estrelas, traits e itens.";
    }else if(target.placement===1){
      review="Use o Counterfactual para encontrar partidas suas parecidas que terminaram pior e identificar o que mudou.";
    }

    return {
      resultTitle,
      resultBody,
      working,
      punished,
      review,
      top4Level,
      bottom4Level,
      top4Gold,
    };
  },[target,detail]);

  return <section className="match-story">
    <article className="match-story-result">
      <span>O QUE ACONTECEU</span>
      <h3>{story.resultTitle}</h3>
      <p>{story.resultBody}</p>
    </article>

    <article className="match-story-good">
      <span>O QUE FUNCIONOU</span>
      <ul>{story.working.slice(0,3).map(item=><li key={item}>{item}</li>)}</ul>
    </article>

    <article className="match-story-warning">
      <span>O QUE TE PUNIU</span>
      <ul>{story.punished.slice(0,3).map(item=><li key={item}>{item}</li>)}</ul>
    </article>

    <article className="match-story-next">
      <span>REVISE PRIMEIRO</span>
      <strong>{story.review}</strong>
      <small>
        {story.top4Level!=null?"Top 4 nível médio "+story.top4Level.toFixed(1)+" · ":""}
        {story.top4Gold!=null?"Top 4 ouro final médio "+story.top4Gold.toFixed(1)+"g":""}
      </small>
    </article>
  </section>;
}
