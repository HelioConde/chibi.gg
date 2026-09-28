import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildChibiSessionPlan } from "../analysis/chibiSessionPlan";
import {
  clearGoal,
  ChibiGoal,
  completeGoal,
  getGoal,
  getGoalHistory,
  goalOutcome,
  goalProgress,
  saveGoal,
  suggestGoal,
} from "../goals";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import { saveLesson } from "../lessons";

type Props={
  playerKey:string;
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder:(unitIds:string[])=>void;
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function traitName(id:string|null,staticData:TftStaticData|null){
  if(!id)return "";
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

function unitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

function shortDate(value:number){
  return new Date(value).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

export default function ChibiSessionPlan({
  playerKey,
  matches,
  staticData,
  onEvidence,
  onOpenBuilder,
}:Props){
  const plan=useMemo(()=>buildChibiSessionPlan(matches),[matches]);
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));
  const [historyVersion,setHistoryVersion]=useState(0);

  useEffect(()=>{
    setGoal(getGoal(playerKey));
  },[playerKey]);

  const progress=useMemo(
    ()=>goal?goalProgress(goal,matches):null,
    [goal,matches],
  );
  const outcome=useMemo(
    ()=>goal?goalOutcome(goal,matches):null,
    [goal,matches],
  );
  const history=useMemo(()=>{
    void historyVersion;
    return getGoalHistory(playerKey);
  },[playerKey,historyVersion]);

  function startGoal(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  function stopGoal(){
    clearGoal(playerKey);
    setGoal(null);
  }

  function finishGoal(){
    const record=completeGoal(playerKey,matches);
    if(!record)return;

    if(
      (record.outcome.verdict==="improved"||record.outcome.verdict==="worse")&&
      record.outcome.matchIds.length>0
    ){
      const direction=record.outcome.verdict==="improved"?"melhorou":"piorou";
      saveLesson(
        playerKey,
        record.outcome.matchIds[0],
        record.title+": "+record.outcome.metricLabel+" "+direction+" de "+record.outcome.metricBefore+" para "+record.outcome.metricAfter+". "+record.outcome.nextFocus,
        record.outcome.matchIds,
      );
    }

    setGoal(null);
    setHistoryVersion(value=>value+1);
  }

  const lineCard=(line:typeof plan.primary,kind:"primary"|"alternative")=>{
    if(!line)return <article className={"session-plan-line "+kind+" empty"}>
      <span>{kind==="primary"?"LINHA DE REFERÊNCIA":"ALTERNATIVA"}</span>
      <strong>Amostra insuficiente</strong>
      <p>Jogue mais partidas para o Chibi montar uma segunda referência sem inventar contexto.</p>
    </article>;

    const title=line.traitId?traitName(line.traitId,staticData):line.label;

    return <article className={"session-plan-line "+kind}>
      <span>{kind==="primary"?"LINHA DE REFERÊNCIA":"ALTERNATIVA PARA ESTUDAR"}</span>
      <h3>{title||line.label}</h3>
      <p>{kind==="primary"
        ?"Use como referência porque é uma das identidades com melhor combinação entre repetição e resultado no seu histórico."
        :"Mantenha como segunda leitura para ampliar repertório quando o spot aparecer naturalmente."}</p>

      <div className="session-plan-units">
        {line.unitIds.slice(0,6).map(id=>{
          const entry=staticEntry(staticData?.champions,id);
          const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
          return <span title={unitName(id,staticData)} key={id}>
            {image?<img src={image} alt={unitName(id,staticData)} onError={(event)=>{event.currentTarget.style.display="none";}}/>:<b>{unitName(id,staticData).slice(0,2)}</b>}
          </span>;
        })}
      </div>

      <div className="session-plan-line-stats">
        <span><small>JOGOS</small><b>{line.games}</b></span>
        <span><small>MÉDIA</small><b>{line.avgPlacement??"—"}</b></span>
        <span><small>TOP 4</small><b>{line.top4Rate}%</b></span>
      </div>

      <div className="session-plan-line-actions">
        {line.matchIds.length>0&&<button onClick={()=>onEvidence(line.matchIds,"Plano da sessão · "+(title||line.label))}>Ver histórico</button>}
        {line.unitIds.length>0&&<button className="primary" onClick={()=>onOpenBuilder(line.unitIds)}>Preparar no Builder</button>}
      </div>
    </article>;
  };

  return <section className="panel chibi-session-plan">
    <div className="session-plan-head">
      <div>
        <span>NEXT SESSION PLAN</span>
        <h2>1 foco. 2 linhas. 5 partidas.</h2>
        <p>O Chibi resume a análise em um plano pequeno para você testar na próxima sessão e medir depois.</p>
      </div>
      <div className="session-plan-count">
        <strong>{goal?progress?.played??0:0}/5</strong>
        <small>{goal?"partidas acompanhadas":"meta ainda não iniciada"}</small>
      </div>
    </div>

    <article className="session-plan-focus">
      <div>
        <span>1 · FOCO DA SESSÃO</span>
        <h3>{plan.focus.title}</h3>
        <p>{plan.focus.body}</p>
        <small>{plan.focus.evidence} · confiança {plan.focus.confidence}</small>
      </div>
      {plan.focus.matchIds.length>0&&<button onClick={()=>onEvidence(plan.focus.matchIds,"Plano da sessão · foco")}>Rever evidências</button>}
    </article>

    <div className="session-plan-lines">
      {lineCard(plan.primary,"primary")}
      {lineCard(plan.alternative,"alternative")}
    </div>

    <div className="session-plan-rule">
      <strong>REGRA DO TESTE</strong>
      <span>{plan.rule}</span>
    </div>

    {outcome&&<section className={"session-outcome "+outcome.verdict}>
      <div className="session-outcome-head">
        <div>
          <span>RESULTADO DO EXPERIMENTO</span>
          <h3>{outcome.title}</h3>
          <p>{outcome.summary}</p>
        </div>
        <em>{outcome.achieved?"meta atingida":"meta não atingida"}</em>
      </div>

      <div className="session-outcome-metrics">
        <article>
          <span>COLOCAÇÃO MÉDIA</span>
          <strong>{outcome.before.avgPlacement??"—"} <i>→</i> {outcome.after.avgPlacement??"—"}</strong>
          <small>{outcome.before.sample} antes · {outcome.after.sample} depois</small>
        </article>
        <article>
          <span>TOP 4</span>
          <strong>{outcome.before.top4Rate}% <i>→</i> {outcome.after.top4Rate}%</strong>
          <small>mudança de {outcome.after.top4Rate-outcome.before.top4Rate>0?"+":""}{outcome.after.top4Rate-outcome.before.top4Rate}%</small>
        </article>
        <article>
          <span>BOTTOM 2</span>
          <strong>{outcome.before.bottom2Rate}% <i>→</i> {outcome.after.bottom2Rate}%</strong>
          <small>mudança de {outcome.after.bottom2Rate-outcome.before.bottom2Rate>0?"+":""}{outcome.after.bottom2Rate-outcome.before.bottom2Rate}%</small>
        </article>
        <article className="focus">
          <span>{outcome.metricLabel}</span>
          <strong>{outcome.metricBefore} <i>→</i> {outcome.metricAfter}</strong>
          <small>Δ {outcome.metricDelta}</small>
        </article>
      </div>

      <div className="session-outcome-next">
        <div>
          <span>O QUE FAZER COM ESTE RESULTADO</span>
          <strong>{outcome.nextFocus}</strong>
          <small>É um sinal de 5 partidas, não prova de causa. Repita antes de transformar em regra permanente.</small>
        </div>
        <div>
          <button onClick={()=>onEvidence(outcome.matchIds,"Experimento · "+(goal?.title||"sessão"))}>Rever 5 partidas</button>
          <button className="primary" onClick={finishGoal}>Concluir e salvar aprendizado</button>
        </div>
      </div>
    </section>}

    {!outcome&&<div className={"session-goal-inline "+(goal?"active":"idle")}>
      {!goal?<>
        <div>
          <span>ACOMPANHAMENTO</span>
          <strong>Transforme o plano em um experimento de 5 partidas</strong>
          <small>O Chibi salva a linha de base neste navegador e mede apenas as partidas novas quando você voltar.</small>
        </div>
        <button onClick={startGoal}>Começar 5 partidas</button>
      </>:<>
        <div className="session-goal-copy">
          <span>META ATIVA</span>
          <strong>{goal.title}</strong>
          <small>{goal.description}</small>
          <p>{progress?.detail}</p>
        </div>

        <div className="session-goal-progress">
          <div><i style={{width:Math.min(100,((progress?.played??0)/(goal.targetGames||5))*100)+"%"}}/></div>
          <span><b>{progress?.played??0}/{goal.targetGames}</b><small>{progress?.finished?(progress.achieved?"meta concluída":"sessão concluída"):"em andamento"}</small></span>
        </div>

        <div className="session-goal-actions">
          {(progress?.matchIds?.length??0)>0&&<button onClick={()=>onEvidence(progress?.matchIds||[],"Meta da sessão · "+goal.title)}>Ver partidas</button>}
          <button className="secondary" onClick={stopGoal}>Encerrar</button>
        </div>
      </>}
    </div>}

    {history.length>0&&<details className="session-experiment-history">
      <summary>
        <span><b>Experimentos anteriores</b><small>{history.length} resultado(s) salvo(s) neste navegador</small></span>
        <em>Histórico</em>
      </summary>
      <div className="session-history-list">
        {history.slice(0,5).map(record=>(
          <article className={record.outcome.verdict} key={record.id}>
            <div>
              <span>{shortDate(record.completedAt)} · {record.title}</span>
              <strong>{record.outcome.title}</strong>
              <small>{record.outcome.metricLabel}: {record.outcome.metricBefore} → {record.outcome.metricAfter}</small>
            </div>
            <button onClick={()=>onEvidence(record.outcome.matchIds,"Experimento salvo · "+record.title)}>Ver partidas</button>
          </article>
        ))}
      </div>
    </details>}
  </section>;
}
