import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildLeakMap, buildPersonalMeta, buildSessionCoach } from "../analysis/chibiProduct";
import { staticEntry, TftStaticData } from "../tftStatic";

function cleanName(value:string){
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

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name || cleanName(id);
}

function formatSessionTime(value:number|null){
  if(!value) return "—";
  return new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}

type Props={
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
};

export default function ChibiInnovations({matches,staticData,onEvidence}:Props){
  const personalMeta=useMemo(()=>buildPersonalMeta(matches),[matches]);
  const session=useMemo(()=>buildSessionCoach(matches),[matches]);
  const leaks=useMemo(()=>buildLeakMap(matches),[matches]);

  return <section className="innovation-grid">
    <article className="panel innovation-card personal-meta-card">
      <div className="innovation-head">
        <div>
          <span>SEU META</span>
          <h2>Linhas que combinam com seu histórico</h2>
        </div>
        <small>Pessoal</small>
      </div>

      {personalMeta.length?(
        <div className="personal-meta-list">
          {personalMeta.slice(0,3).map((line,index)=>(
            <div className="personal-meta-row" key={line.id}>
              <div className="meta-rank">{index+1}</div>
              <div className="meta-line-main">
                <div className="meta-line-title">
                  <strong>{traitName(line.id,staticData)}</strong>
                  <span>score {line.fitScore}</span>
                </div>
                <div className="fit-track"><i style={{width:line.fitScore+"%"}}/></div>
                <small>{line.games} jogos · média {line.avgPlacement} · Top 4 {line.top4Rate}% · confiança {line.confidence}</small>
              </div>
              <button onClick={()=>onEvidence(line.matchIds,"Seu Meta · "+traitName(line.id,staticData))}>Ver</button>
            </div>
          ))}
        </div>
      ):(
        <p className="innovation-empty">Carregue mais partidas para identificar linhas repetidas com segurança.</p>
      )}

      <p className="innovation-note">Score pessoal de 0–100 para ordenar sinais do seu histórico. Não é probabilidade de vitória nem tier global.</p>
    </article>

    <article className="panel innovation-card session-card">
      <div className="innovation-head">
        <div>
          <span>SESSION COACH</span>
          <h2>{session.focus}</h2>
        </div>
        <small>{session.games} jogos</small>
      </div>

      <div className="session-metrics">
        <div><span>Média</span><strong>{session.avgPlacement??"—"}</strong></div>
        <div><span>Top 4</span><strong>{session.top4Rate}%</strong></div>
        <div><span>Bottom 2</span><strong>{session.bottom2Rate}%</strong></div>
      </div>

      <p className="session-reason">{session.reason}</p>

      <div className="session-time">
        <span>{formatSessionTime(session.startedAt)}</span>
        <i/>
        <span>{formatSessionTime(session.endedAt)}</span>
      </div>

      {session.matchIds.length>0&&<button className="evidence-button" onClick={()=>onEvidence(session.matchIds,"Sessão recente")}>Ver sessão analisada</button>}
    </article>

    <article className="panel innovation-card leak-card">
      <div className="innovation-head">
        <div>
          <span>LP LEAK MAP</span>
          <h2>{leaks.primary?leaks.primary.title:"Sem vazamento dominante"}</h2>
        </div>
        {leaks.primary&&<small>{leaks.primary.severity}/100</small>}
      </div>

      <div className="leak-list">
        {leaks.items.length?leaks.items.map((leak)=>(
          <div className="leak-row" key={leak.id}>
            <div className="leak-top">
              <strong>{leak.title}</strong>
              <span>{leak.confidence}</span>
            </div>
            <div className="leak-track"><i style={{width:leak.severity+"%"}}/></div>
            <p>{leak.description}</p>
            <div className="leak-bottom">
              <small>{leak.evidence}</small>
              <button onClick={()=>onEvidence(leak.matchIds,"LP Leak · "+leak.title)}>Ver partidas</button>
            </div>
          </div>
        )):<p className="innovation-empty">A amostra ainda não mostra um padrão de vazamento forte.</p>}
      </div>

      <p className="innovation-note">“Leak” é um sinal de investigação baseado em colocação. Não representa LP calculado nem prova causalidade.</p>
    </article>
  </section>;
}
