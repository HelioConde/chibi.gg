import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildChibiDNA } from "../analysis/chibiInsights";
import {
  ChibiGoal,
  clearGoal,
  getGoal,
  goalProgress,
  saveGoal,
  suggestGoal,
} from "../goals";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

type PathRecord={
  id:string;
  title:string;
  type:ChibiGoal["type"];
  completedAt:number;
  achieved:boolean;
  baseline:number|null;
  final:number|null;
  detail:string;
};

type Skill={
  id:"stability"|"flexibility"|"conversion"|"consistency";
  label:string;
  value:number;
  description:string;
};

const PREFIX="chibi.gg:learning-path:v1:";

function storageKey(playerKey:string){
  return PREFIX+encodeURIComponent(playerKey.toLowerCase());
}

function readHistory(playerKey:string):PathRecord[]{
  try{
    const raw=localStorage.getItem(storageKey(playerKey));
    if(!raw)return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function writeHistory(playerKey:string,records:PathRecord[]){
  localStorage.setItem(storageKey(playerKey),JSON.stringify(records.slice(-12)));
}

function avg(matches:TftMatch[]){
  if(!matches.length)return null;
  return matches.reduce((sum,match)=>sum+match.placement,0)/matches.length;
}

function primaryTrait(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function metricFor(type:ChibiGoal["type"],matches:TftMatch[]):number|null{
  if(!matches.length)return null;

  if(type==="protect-floor"){
    return Math.round((1-matches.filter(match=>match.placement>=7).length/matches.length)*100);
  }

  if(type==="convert-top4"){
    const top4=matches.filter(match=>match.placement<=4);
    if(!top4.length)return 0;
    return Math.round(top4.filter(match=>match.placement===1).length/top4.length*100);
  }

  if(type==="diversify"){
    const lines=new Set(matches.map(primaryTrait).filter(Boolean));
    return Math.min(100,Math.round(lines.size/Math.max(2,matches.length)*200));
  }

  const mean=avg(matches);
  return mean==null?null:Math.max(0,Math.min(100,Math.round((8.5-mean)/7.5*100)));
}

function metricLabel(type:ChibiGoal["type"]){
  if(type==="protect-floor")return "proteção contra Bottom 2";
  if(type==="convert-top4")return "conversão de Top 4";
  if(type==="diversify")return "diversidade de linhas";
  return "resultado da sessão";
}

function formatDate(value:number){
  return new Date(value).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

export default function ChibiLearningPath({playerKey,matches,onEvidence}:Props){
  const [version,setVersion]=useState(0);
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));

  useEffect(()=>{
    setGoal(getGoal(playerKey));
    setVersion(value=>value+1);
  },[playerKey]);

  const dna=useMemo(()=>buildChibiDNA(matches),[matches]);
  const skills=useMemo<Skill[]>(()=>[
    {
      id:"stability",
      label:"Estabilidade",
      value:dna.stability,
      description:"Evitar 7º/8º e proteger o piso das partidas.",
    },
    {
      id:"flexibility",
      label:"Flexibilidade",
      value:dna.flexibility,
      description:"Usar mais de uma linha sem forçar sempre o mesmo caminho.",
    },
    {
      id:"conversion",
      label:"Conversão",
      value:dna.conversion,
      description:"Transformar boas partidas e Top 4 em vitórias.",
    },
    {
      id:"consistency",
      label:"Consistência",
      value:dna.consistency,
      description:"Reduzir variação entre partidas boas e ruins.",
    },
  ],[dna]);

  const weakest=skills.slice().sort((a,b)=>a.value-b.value)[0];
  const progress=useMemo(()=>goal?goalProgress(goal,matches):null,[goal,matches]);

  const baselineMatches=useMemo(()=>{
    if(!goal)return [];
    const ids=new Set(goal.baselineIds);
    return matches.filter(match=>ids.has(match.id)).slice(0,12);
  },[goal,matches]);

  const practiceMatches=useMemo(()=>{
    if(!goal||!progress)return [];
    const ids=new Set(progress.matchIds);
    return matches.filter(match=>ids.has(match.id));
  },[goal,progress,matches]);

  const baselineMetric=goal?metricFor(goal.type,baselineMatches):null;
  const currentMetric=goal?metricFor(goal.type,practiceMatches):null;
  const metricDelta=baselineMetric!=null&&currentMetric!=null?currentMetric-baselineMetric:null;

  const history=useMemo(()=>{
    void version;
    return readHistory(playerKey).slice().reverse();
  },[playerKey,version]);

  function start(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  function archiveAndContinue(){
    if(!goal||!progress?.finished)return;

    const records=readHistory(playerKey);
    const record:PathRecord={
      id:goal.id,
      title:goal.title,
      type:goal.type,
      completedAt:Date.now(),
      achieved:progress.achieved,
      baseline:baselineMetric,
      final:currentMetric,
      detail:progress.detail,
    };

    if(!records.some(item=>item.id===record.id)){
      writeHistory(playerKey,[...records,record]);
    }

    clearGoal(playerKey);
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
    setVersion(value=>value+1);
  }

  const stage=goal
    ? progress?.finished
      ? 3
      : (progress?.played||0)>0
        ? 2
        : 1
    : 0;

  return <section className="panel learning-path-card">
    <div className="learning-path-head">
      <div>
        <span>CHIBI LEARNING PATH</span>
        <h2>Treine uma habilidade por ciclo</h2>
        <p>O Chibi escolhe um foco, acompanha 5 partidas e compara o resultado com sua linha de base.</p>
      </div>
      <div className="learning-path-level">
        <small>FOCO MAIS FRACO</small>
        <strong>{weakest?.label||"—"}</strong>
        <span>{weakest?.value??0}/100</span>
      </div>
    </div>

    <div className="learning-skill-grid">
      {skills.map(skill=>(
        <article className={skill.id===weakest?.id?"weakest":""} key={skill.id}>
          <div>
            <span>{skill.label}</span>
            <strong>{skill.value}</strong>
          </div>
          <div className="learning-skill-track"><i style={{width:skill.value+"%"}}/></div>
          <small>{skill.description}</small>
        </article>
      ))}
    </div>

    <div className="learning-cycle">
      <div className="learning-cycle-steps">
        {["Diagnóstico","Prática","Validação"].map((label,index)=>(
          <div className={(stage>=index+1?"active ":"")+(stage>index+1?"done":"")} key={label}>
            <span>{stage>index+1?"✓":index+1}</span>
            <b>{label}</b>
          </div>
        ))}
      </div>

      {goal?(
        <div className="learning-mission">
          <div className="learning-mission-main">
            <span>MISSÃO ATUAL</span>
            <h3>{goal.title}</h3>
            <p>{goal.description}</p>

            <div className="learning-mission-progress">
              <div><i style={{width:Math.min(100,((progress?.played||0)/goal.targetGames)*100)+"%"}}/></div>
              <span>{progress?.played||0}/{goal.targetGames} partidas</span>
            </div>

            <small>{progress?.detail}</small>
          </div>

          <aside className="learning-before-after">
            <span>{metricLabel(goal.type).toUpperCase()}</span>
            <div>
              <article>
                <small>ANTES</small>
                <strong>{baselineMetric==null?"—":baselineMetric}</strong>
              </article>
              <b>→</b>
              <article className={metricDelta!=null&&metricDelta>0?"better":metricDelta!=null&&metricDelta<0?"worse":""}>
                <small>AGORA</small>
                <strong>{currentMetric==null?"—":currentMetric}</strong>
              </article>
            </div>
            <em>{metricDelta==null
              ?"Aguardando partidas novas"
              :metricDelta>0
                ? "+"+metricDelta+" pontos no indicador"
                :metricDelta<0
                  ? metricDelta+" pontos no indicador"
                  : "Indicador estável"}</em>
          </aside>
        </div>
      ):(
        <div className="learning-path-empty">
          <div>
            <span>PRÓXIMO CICLO</span>
            <h3>{weakest?("Comece trabalhando "+weakest.label.toLowerCase()):"Crie sua primeira linha de base"}</h3>
            <p>O foco é definido pelos sinais do seu histórico atual e medido nas próximas 5 partidas.</p>
          </div>
          <button onClick={start}>Iniciar ciclo de 5 partidas</button>
        </div>
      )}

      {goal&&<div className="learning-cycle-actions">
        {progress?.matchIds?.length>0&&<button onClick={()=>onEvidence(progress.matchIds,"Learning Path · partidas do ciclo")}>
          Ver partidas deste ciclo
        </button>}
        {goal.baselineIds.length>0&&<button onClick={()=>onEvidence(goal.baselineIds.slice(0,12),"Learning Path · linha de base")}>
          Ver linha de base
        </button>}
        {progress?.finished&&<button className="primary" onClick={archiveAndContinue}>
          {progress.achieved?"Meta atingida · próximo foco":"Encerrar ciclo e recalibrar"}
        </button>}
      </div>}
    </div>

    {history.length>0&&<details className="learning-path-history">
      <summary>
        <span><b>Histórico de ciclos</b><small>Resultados salvos neste navegador</small></span>
        <em>{history.length}</em>
      </summary>
      <div>
        {history.slice(0,5).map(record=>{
          const delta=record.baseline!=null&&record.final!=null?record.final-record.baseline:null;
          return <article key={record.id}>
            <span className={record.achieved?"success":"neutral"}>{record.achieved?"Concluído":"Recalibrado"}</span>
            <div>
              <strong>{record.title}</strong>
              <small>{formatDate(record.completedAt)} · {record.detail}</small>
            </div>
            <b>{delta==null?"—":(delta>0?"+":"")+delta}</b>
          </article>;
        })}
      </div>
    </details>}

    <p className="learning-path-note">A trilha mede mudança dentro da amostra carregada. Ela não é um ranking de habilidade nem substitui review de decisões por rodada.</p>
  </section>;
}
