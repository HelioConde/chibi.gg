import { useEffect, useMemo, useState } from "react";
import { RecentPlayer } from "../recentPlayers";
import { getActiveSession } from "../sessionMode";
import { getDueLessons } from "../lessons";

type Props={
  recentPlayers:RecentPlayer[];
  onOpenSession:(player:RecentPlayer)=>void;
  onOpenLesson:(player:RecentPlayer)=>void;
};

function playerKey(player:RecentPlayer){
  return player.platform+":"+player.gameName+"#"+player.tagLine;
}

export default function HomeSessionResume({recentPlayers,onOpenSession,onOpenLesson}:Props){
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1);
    window.addEventListener("chibi:session-change",refresh);
    window.addEventListener("chibi:lessons-change",refresh);
    return ()=>{
      window.removeEventListener("chibi:session-change",refresh);
      window.removeEventListener("chibi:lessons-change",refresh);
    };
  },[]);

  const rows=useMemo(()=>{
    void version;
    const result:Array<
      | {type:"session";player:RecentPlayer;session:NonNullable<ReturnType<typeof getActiveSession>>}
      | {type:"lesson";player:RecentPlayer;lesson:ReturnType<typeof getDueLessons>[number];dueCount:number}
    >=[];

    for(const player of recentPlayers){
      const key=playerKey(player);
      const session=getActiveSession(key);
      if(session){
        result.push({type:"session",player,session});
        continue;
      }

      const due=getDueLessons(key);
      if(due[0]){
        result.push({type:"lesson",player,lesson:due[0],dueCount:due.length});
      }
    }

    return result.slice(0,3);
  },[recentPlayers,version]);

  if(!rows.length)return null;

  const sessionCount=rows.filter(row=>row.type==="session").length;
  const lessonCount=rows.filter(row=>row.type==="lesson").length;

  return <section className="home-session-resume">
    <div className="home-session-head">
      <div>
        <span>CONTINUAR APRENDENDO</span>
        <strong>{sessionCount
          ? "Retome sua sessão ou uma lição pendente"
          : "Você tem lições esperando revisão"}</strong>
      </div>
      <small>
        {sessionCount?sessionCount+" sessão"+(sessionCount===1?"":"ões"):""}
        {sessionCount&&lessonCount?" · ":""}
        {lessonCount?lessonCount+" lembrete"+(lessonCount===1?"":"s"):""}
      </small>
    </div>

    <div className="home-session-list">
      {rows.map(row=>{
        const player=row.player;

        if(row.type==="session"){
          return <button className="session-row" onClick={()=>onOpenSession(player)} key={row.session.id}>
            <div className="home-session-player">
              <span>{player.gameName.slice(0,1).toUpperCase()}</span>
              <div>
                <strong>{player.gameName}<small>#{player.tagLine}</small></strong>
                <em>{player.platform.toUpperCase()} · {player.rankLabel}</em>
              </div>
            </div>
            <div className="home-session-focus">
              <small>FOCO DA SESSÃO</small>
              <strong>{row.session.title}</strong>
              <span>{row.session.focusTitle}</span>
            </div>
            <div className="home-session-open">
              <b>Continuar</b>
              <span>→</span>
            </div>
          </button>;
        }

        return <button className="lesson-row" onClick={()=>onOpenLesson(player)} key={row.lesson.id}>
          <div className="home-session-player lesson">
            <span>✦</span>
            <div>
              <strong>{player.gameName}<small>#{player.tagLine}</small></strong>
              <em>{row.dueCount} lição{row.dueCount===1?"":"ões"} para revisar</em>
            </div>
          </div>
          <div className="home-session-focus">
            <small>CHIBI LESSON</small>
            <strong>{row.lesson.text}</strong>
            <span>{row.lesson.reviewCount===0?"Ainda não revisada":row.lesson.reviewCount+" revisão"+(row.lesson.reviewCount===1?"":"ões")}</span>
          </div>
          <div className="home-session-open">
            <b>Revisar</b>
            <span>→</span>
          </div>
        </button>;
      })}
    </div>
  </section>;
}
