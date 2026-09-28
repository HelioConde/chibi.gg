import { useEffect, useMemo, useState } from "react";
import { RecentPlayer } from "../recentPlayers";
import { getActiveSession } from "../sessionMode";

type Props={
  recentPlayers:RecentPlayer[];
  onOpen:(player:RecentPlayer)=>void;
};

function playerKey(player:RecentPlayer){
  return player.platform+":"+player.gameName+"#"+player.tagLine;
}

export default function HomeSessionResume({recentPlayers,onOpen}:Props){
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1);
    window.addEventListener("chibi:session-change",refresh);
    return ()=>window.removeEventListener("chibi:session-change",refresh);
  },[]);

  const sessions=useMemo(()=>{
    void version;
    return recentPlayers
      .map(player=>({player,session:getActiveSession(playerKey(player))}))
      .filter(row=>Boolean(row.session))
      .slice(0,2);
  },[recentPlayers,version]);

  if(!sessions.length)return null;

  return <section className="home-session-resume">
    <div className="home-session-head">
      <div>
        <span>CONTINUAR APRENDENDO</span>
        <strong>Você tem uma Chibi Session ativa</strong>
      </div>
      <small>3 partidas · 1 foco</small>
    </div>

    <div className="home-session-list">
      {sessions.map(({player,session})=>session&&(
        <button onClick={()=>onOpen(player)} key={session.id}>
          <div className="home-session-player">
            <span>{player.gameName.slice(0,1).toUpperCase()}</span>
            <div>
              <strong>{player.gameName}<small>#{player.tagLine}</small></strong>
              <em>{player.platform.toUpperCase()} · {player.rankLabel}</em>
            </div>
          </div>
          <div className="home-session-focus">
            <small>FOCO DA SESSÃO</small>
            <strong>{session.title}</strong>
            <span>{session.focusTitle}</span>
          </div>
          <div className="home-session-open">
            <b>Continuar</b>
            <span>→</span>
          </div>
        </button>
      ))}
    </div>
  </section>;
}
