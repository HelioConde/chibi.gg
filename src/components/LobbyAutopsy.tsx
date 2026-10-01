import { useMemo } from "react";
import { TftMatch, TftMatchDetail } from "../api/tft";
import { buildLobbyAutopsy } from "../analysis/lobbyAutopsy";
import { staticEntry, TftStaticData } from "../tftStatic";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  target:TftMatch;
  detail:TftMatchDetail;
  staticData:TftStaticData|null;
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\s{2,}/g," ")
    .trim();
}

function unitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

export default function LobbyAutopsy({target,detail,staticData}:Props){
  const autopsy=useMemo(()=>buildLobbyAutopsy(target,detail),[target,detail]);

  return <section className="lobby-autopsy lobby-autopsy-v2 match-stage-with-art">
    <AdaptiveArtwork className="match-stage-art match-stage-art-lobby" src={SITE_IMAGES.ui.comparison} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
    <div className="autopsy-head">
      <div>
        <span>POR QUE EU PERDI? · LOBBY AUTOPSY</span>
        <h3>{autopsy.summary}</h3>
      </div>
      <small>snapshot final · 8 boards</small>
    </div>

    <article className={"autopsy-diagnosis confidence-"+autopsy.diagnosis.confidence}>
      <div className="autopsy-diagnosis-copy">
        <span>MAIOR GAP OBSERVÁVEL</span>
        <h4>{autopsy.diagnosis.title}</h4>
        <p>{autopsy.diagnosis.body}</p>
        <div className="autopsy-diagnosis-evidence">
          {autopsy.diagnosis.evidence.slice(0,3).map(item=><small key={item}>{item}</small>)}
        </div>
      </div>
      <aside>
        <small>FORÇA DO SINAL</small>
        <strong>{autopsy.diagnosis.score}%</strong>
        <span>confiança {autopsy.diagnosis.confidence}</span>
        <i><b style={{width:autopsy.diagnosis.score+"%"}}/></i>
      </aside>
    </article>

    <div className="autopsy-priority">
      <span>REVISE PRIMEIRO</span>
      <strong>{autopsy.priority}</strong>
    </div>

    {autopsy.signals.length>0&&<details className="autopsy-primary-signals">
      <summary>
        <span>
          <b>Sinais observados nesta lobby</b>
          <small>{autopsy.signals.slice(0,3).map(signal=>signal.title).join(" · ")}</small>
        </span>
        <em>{Math.min(3,autopsy.signals.length)} sinais +</em>
      </summary>
      <div className="autopsy-grid">
        {autopsy.signals.slice(0,3).map(signal=>(
          <article className={"autopsy-signal "+signal.tone} key={signal.id}>
            <div className="autopsy-signal-kicker">
              <span>{signal.tone==="warning"?"ATENÇÃO":signal.tone==="good"?"FUNCIONOU":"OBSERVADO"}</span>
              <em>{signal.strength}% · {signal.confidence}</em>
            </div>
            <h4>{signal.title}</h4>
            <p>{signal.body}</p>
            <small>{signal.evidence}</small>
          </article>
        ))}
      </div>
    </details>}

    <div className="autopsy-evidence-line">
      <span>SNAPSHOT</span>
      <strong>
        Board {autopsy.benchmarks.yourBoardValue}g
        {autopsy.benchmarks.top4BoardValue!=null&&<> <em>vs</em> Top 4 {autopsy.benchmarks.top4BoardValue}g</>}
        {" · "}Itens {autopsy.benchmarks.yourItems}
        {autopsy.benchmarks.top4Items!=null&&<> <em>vs</em> {autopsy.benchmarks.top4Items}</>}
        {" · "}Nv {autopsy.benchmarks.yourLevel}
        {autopsy.benchmarks.top4Level!=null&&<> <em>vs</em> {autopsy.benchmarks.top4Level}</>}
        {" · "}{autopsy.benchmarks.yourThreeStars} unidade(s) 3★
        {" · "}{autopsy.contested.length} contestada(s)
      </strong>
    </div>

    {autopsy.benchmarks.abovePlacement!=null&&<div className="autopsy-above-inline">
      <span>LOGO ACIMA</span>
      <strong>{autopsy.benchmarks.abovePlacement}º</strong>
      <small>
        {autopsy.benchmarks.aboveBoardValue??"—"}g board
        {" · "}{autopsy.benchmarks.aboveItems??"—"} itens
        {" · "}Nv {autopsy.benchmarks.aboveLevel??"—"}
        {" · "}{autopsy.benchmarks.aboveThreeStars??"—"} 3★
      </small>
    </div>}

    {autopsy.contested.length>0&&<details className="autopsy-more">
      <summary>
        <span><b>Ver contestação por cópias</b><small>Estimativa pelo nível de estrela no snapshot final</small></span>
        <em>{autopsy.contested.length}</em>
      </summary>
      <div className="autopsy-contested-list autopsy-contested-v2">
        {autopsy.contested.slice(0,8).map(row=>(
          <div className={row.itemized?"itemized":""} key={row.characterId}>
            <div>
              <strong>{unitName(row.characterId,staticData)}</strong>
              {row.itemized&&<em>CARRY</em>}
            </div>
            <span>Você ~{row.yourCopies} · rivais ~{row.copies} cópias · {row.opponents} rival(is)</span>
          </div>
        ))}
      </div>
    </details>}

    {autopsy.closest&&<div className="autopsy-closest">
      <span>BOARD MAIS PARECIDO NA LOBBY</span>
      <div>
        <strong>{autopsy.closest.placement}º lugar · {autopsy.closest.similarity}% semelhante</strong>
        <small>
          {autopsy.closest.sharedTraits.slice(0,3).map(id=>traitName(id,staticData)).join(" · ")||"sem trait principal compartilhada"}
          {" · board Δ "+(autopsy.closest.boardValueDelta>0?"+":"")+autopsy.closest.boardValueDelta+"g"}
          {" · itens Δ "+(autopsy.closest.itemDelta>0?"+":"")+autopsy.closest.itemDelta}
        </small>
      </div>
    </div>}

    {autopsy.signals.length>3&&<details className="autopsy-more autopsy-all-signals">
      <summary>
        <span><b>Ver outros sinais encontrados</b><small>Gaps secundários do snapshot final</small></span>
        <em>{autopsy.signals.length-3}</em>
      </summary>
      <div className="autopsy-secondary-list">
        {autopsy.signals.slice(3).map(signal=>(
          <article key={signal.id}>
            <div>
              <strong>{signal.title}</strong>
              <span>{signal.strength}% · {signal.confidence}</span>
            </div>
            <p>{signal.body}</p>
            <small>{signal.evidence}</small>
          </article>
        ))}
      </div>
    </details>}

    <p className="autopsy-disclaimer">O Chibi compara o estado final disponível na Riot API. “Força do sinal” mede o tamanho do contraste observado nesta lobby; não é probabilidade de causa. Shop, HP por rodada, posicionamento histórico e timing de rolldown não estão disponíveis neste snapshot.</p>
  </section>;
}
