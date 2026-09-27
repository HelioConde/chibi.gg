import { useMemo } from "react";
import { TftMatch, TftMatchDetail } from "../api/tft";
import { buildLobbyAutopsy } from "../analysis/lobbyAutopsy";
import { staticEntry, TftStaticData } from "../tftStatic";

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

  return <section className="lobby-autopsy">
    <div className="autopsy-head">
      <div>
        <span>LOBBY AUTOPSY</span>
        <h3>{autopsy.summary}</h3>
      </div>
      <small>snapshot final</small>
    </div>

    <div className="autopsy-priority">
      <span>REVISE PRIMEIRO</span>
      <strong>{autopsy.priority}</strong>
    </div>

    <div className="autopsy-grid">
      {autopsy.signals.slice(0,3).map(signal=>(
        <article className={"autopsy-signal "+signal.tone} key={signal.id}>
          <span>{signal.tone==="warning"?"ATENÇÃO":signal.tone==="good"?"FUNCIONOU":"OBSERVADO"}</span>
          <h4>{signal.title}</h4>
          <p>{signal.body}</p>
          <small>{signal.evidence}</small>
        </article>
      ))}
    </div>

    <div className="autopsy-facts">
      <div>
        <span>Nível</span>
        <strong>{autopsy.benchmarks.yourLevel}</strong>
        <small>Top 4 {autopsy.benchmarks.top4Level??"—"}</small>
      </div>
      <div>
        <span>3★</span>
        <strong>{autopsy.benchmarks.yourThreeStars}</strong>
        <small>Top 4 {autopsy.benchmarks.top4ThreeStars??"—"}</small>
      </div>
      <div>
        <span>Ouro final</span>
        <strong>{autopsy.benchmarks.yourGold}g</strong>
        <small>Lobby {autopsy.benchmarks.lobbyGold??"—"}g</small>
      </div>
      <div>
        <span>Contestadas</span>
        <strong>{autopsy.contested.length}</strong>
        <small>unidades compartilhadas</small>
      </div>
    </div>

    {autopsy.contested.length>0&&<details className="autopsy-more">
      <summary>
        <span><b>Ver unidades contestadas</b><small>Quem mais apareceu no lobby final</small></span>
        <em>{autopsy.contested.length}</em>
      </summary>
      <div className="autopsy-contested-list">
        {autopsy.contested.slice(0,8).map(row=>(
          <div key={row.characterId}>
            <strong>{unitName(row.characterId,staticData)}</strong>
            <span>{row.opponents} rival(is)</span>
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
        </small>
      </div>
    </div>}

    <p className="autopsy-disclaimer">Lobby Autopsy compara apenas o estado final disponível na Riot API. Ele aponta diferenças observáveis; não prova qual decisão causou a colocação.</p>
  </section>;
}
