import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildChibiSessionPlan } from "../analysis/chibiSessionPlan";
import { clearGoal, ChibiGoal, getGoal, goalProgress, saveGoal, suggestGoal } from "../goals";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";

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

export default function ChibiSessionPlan({
  playerKey,
  matches,
  staticData,
  onEvidence,
  onOpenBuilder,
}:Props){
  const plan=useMemo(()=>buildChibiSessionPlan(matches),[matches]);
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));

  useEffect(()=>{
    setGoal(getGoal(playerKey));
  },[playerKey]);

  const progress=useMemo(
    ()=>goal?goalProgress(goal,matches):null,
    [goal,matches],
  );

  function startGoal(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  function stopGoal(){
    clearGoal(playerKey);
    setGoal(null);
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

    <div className={"session-goal-inline "+(goal?"active":"idle")}>
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
    </div>
  </section>;
}
