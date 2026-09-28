import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import {
  cancelChibiSession,
  ChibiSession,
  ChibiSessionRecord,
  finishChibiSession,
  getActiveSession,
  getSessionHistory,
  sessionProgress,
  startChibiSession,
} from "../sessionMode";

type Props={
  playerKey:string;
  matches:TftMatch[];
  refreshing?:boolean;
  onRefresh?:()=>void;
  onEvidence:(ids:string[],label:string)=>void;
};

function placementClass(value:number){
  if(value===1)return "p1";
  if(value<=4)return "p2";
  if(value>=7)return "p7";
  return "";
}

function formatDate(value:number){
  return new Date(value).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

export default function ChibiSessionMode({playerKey,matches,refreshing=false,onRefresh,onEvidence}:Props){
  const [version,setVersion]=useState(0);
  const [active,setActive]=useState<ChibiSession|null>(()=>getActiveSession(playerKey));
  const [lastRecord,setLastRecord]=useState<ChibiSessionRecord|null>(null);

  useEffect(()=>{
    setActive(getActiveSession(playerKey));
    setLastRecord(null);
    setVersion(value=>value+1);
  },[playerKey]);

  const progress=useMemo(
    ()=>active?sessionProgress(active,matches):null,
    [active,matches],
  );

  const history=useMemo(()=>{
    void version;
    return getSessionHistory(playerKey);
  },[playerKey,version]);

  function start(){
    const next=startChibiSession(playerKey,matches);
    setActive(next);
    setVersion(value=>value+1);
  }

  function finish(){
    if(!active)return;
    const record=finishChibiSession(playerKey,matches);
    setActive(null);
    setLastRecord(record);
    setVersion(value=>value+1);
  }

  function cancel(){
    cancelChibiSession(playerKey);
    setActive(null);
    setVersion(value=>value+1);
  }

  return <section className={"panel chibi-session "+(active?"active":"idle")}>
    <div className="session-head">
      <div>
        <span>CHIBI SESSION</span>
        <h2>{active?"Uma regra. Três partidas.":"Entre na fila com um plano simples"}</h2>
        <p>{active
          ?"O Chibi acompanha somente os jogos novos desde o início desta sessão."
          :"Inicie uma sessão curta para testar uma única hipótese sem tentar corrigir tudo ao mesmo tempo."}</p>
      </div>
      {active&&<div className="session-counter">
        <small>SESSÃO</small>
        <strong>{progress?.played||0}/{active.targetGames}</strong>
        <span>partidas</span>
      </div>}
    </div>

    {active?(
      <>
        <div className="session-focus">
          <article className="session-rule">
            <span>SUA REGRA NESTA SESSÃO</span>
            <h3>{active.focusTitle}</h3>
            <ol>
              {active.focusSteps.map((step,index)=>(
                <li key={index}><b>{index+1}</b><p>{step}</p></li>
              ))}
            </ol>
          </article>

          <article className="session-avoid">
            <span>NÃO FAÇA ISSO</span>
            <p>{active.avoid}</p>
            <small>{active.successMetric}</small>
          </article>
        </div>

        <div className="session-live">
          <div className="session-placements">
            <span>PARTIDAS DA SESSÃO</span>
            <div>
              {Array.from({length:active.targetGames}).map((_,index)=>{
                const placement=progress?.placements[index];
                return <i className={placement?placementClass(placement):""} key={index}>
                  {placement?placement+"º":index+1}
                </i>;
              })}
            </div>
          </div>

          <div className="session-comparison">
            <article>
              <small>ANTES</small>
              <strong>{progress?.baselineAverage??"—"}</strong>
              <span>média das {active.targetGames} anteriores</span>
            </article>
            <b>→</b>
            <article className={progress?.delta!=null&&progress.delta<0?"better":progress?.delta!=null&&progress.delta>0?"worse":""}>
              <small>SESSÃO</small>
              <strong>{progress?.average??"—"}</strong>
              <span>{progress?.played||0} jogo(s)</span>
            </article>
          </div>
        </div>

        <div className="session-status">
          <div>
            <span>{progress?.finished
              ? progress.achieved?"META DA SESSÃO ATINGIDA":"SESSÃO CONCLUÍDA"
              : progress?.played?"SESSÃO EM ANDAMENTO":"PRONTO PARA A PRIMEIRA FILA"}</span>
            <strong>{progress?.detail||active.description}</strong>
            {progress?.delta!=null&&<small>{progress.delta<0
              ? "Colocação média melhorou "+Math.abs(progress.delta).toFixed(2)+" ponto(s) vs. bloco anterior."
              : progress.delta>0
                ? "Colocação média piorou "+progress.delta.toFixed(2)+" ponto(s) vs. bloco anterior."
                : "Colocação média igual ao bloco anterior."}</small>}
          </div>

          <div className="session-actions">
            {onRefresh&&<button onClick={onRefresh} disabled={refreshing}>
              {refreshing?"Atualizando...":"Atualizar sessão"}
            </button>}
            {progress&&progress.matchIds.length>0&&<button onClick={()=>onEvidence(progress.matchIds,"Chibi Session · jogos desta sessão")}>
              Ver jogos
            </button>}
            {progress?.finished
              ? <button className="primary" onClick={finish}>Fechar sessão</button>
              : <button className="ghost" onClick={cancel}>Cancelar</button>}
          </div>
        </div>
      </>
    ):(
      <>
        {lastRecord&&<article className="session-recap">
          <div className="session-recap-main">
            <span>SESSÃO FECHADA</span>
            <h3>{lastRecord.achieved?"O experimento bateu a meta":"O experimento terminou — agora revise o porquê"}</h3>
            <p>{lastRecord.detail}</p>
            <div className="session-recap-placements">
              {lastRecord.placements.map((placement,index)=><i className={placementClass(placement)} key={index}>{placement}º</i>)}
            </div>
          </div>

          <div className="session-recap-delta">
            <small>MÉDIA</small>
            <div>
              <span><b>{lastRecord.baselineAverage??"—"}</b><em>antes</em></span>
              <strong>→</strong>
              <span className={lastRecord.delta!=null&&lastRecord.delta<0?"better":lastRecord.delta!=null&&lastRecord.delta>0?"worse":""}>
                <b>{lastRecord.average??"—"}</b><em>sessão</em>
              </span>
            </div>
            <p>{lastRecord.delta==null
              ?"Sem bloco anterior suficiente para comparar."
              :lastRecord.delta<0
                ?"Melhora observada de "+Math.abs(lastRecord.delta).toFixed(2)+" ponto(s) na colocação média."
                :lastRecord.delta>0
                  ?"Piora observada de "+lastRecord.delta.toFixed(2)+" ponto(s) na colocação média."
                  :"A colocação média ficou estável."}</p>
          </div>

          <div className="session-recap-actions">
            {lastRecord.matchIds.length>0&&<button onClick={()=>onEvidence(lastRecord.matchIds,"Chibi Session · revisão do ciclo")}>Revisar as 3 partidas</button>}
            <button className="primary" onClick={()=>{setLastRecord(null);start();}}>Iniciar novo experimento</button>
          </div>
        </article>}

        {!lastRecord&&<div className="session-start">
        <div>
          <span>ANTES DE JOGAR</span>
          <h3>Teste só uma mudança nas próximas 3 partidas.</h3>
          <p>O foco será escolhido pelos sinais atuais do seu perfil. Depois, o Chibi compara essa sessão com as partidas imediatamente anteriores.</p>
        </div>
        <button onClick={start}>Iniciar sessão de 3 partidas</button>
      </div>}
      </>
    )}

    {history.length>0&&<details className="session-history">
      <summary>
        <span><b>Sessões anteriores</b><small>Fechamentos salvos neste navegador</small></span>
        <em>{history.length}</em>
      </summary>
      <div className="session-history-list">
        {history.slice(0,5).map(record=>(
          <article key={record.id}>
            <div>
              <span className={record.achieved?"success":"neutral"}>{record.achieved?"Meta atingida":"Concluída"}</span>
              <strong>{record.title}</strong>
              <small>{formatDate(record.endedAt)} · {record.detail}</small>
            </div>
            <div className="session-history-placements">
              {record.placements.map((placement,index)=><i className={placementClass(placement)} key={index}>{placement}</i>)}
            </div>
            <b>{record.delta==null?"—":(record.delta<0?"▲ ":"▼ ")+Math.abs(record.delta).toFixed(2)}</b>
          </article>
        ))}
      </div>
    </details>}

    <p className="session-note">Uma sessão mede mudança observada em poucas partidas; não prova que o foco escolhido causou o resultado.</p>
  </section>;
}
