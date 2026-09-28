import { useEffect, useMemo, useState } from "react";
import {
  archiveLesson,
  ChibiLesson,
  getDueLessons,
  getLessons,
  lessonDueAt,
  markLessonReviewed,
} from "../lessons";

type Props={
  playerKey:string;
  onEvidence:(ids:string[],label:string)=>void;
};

function relativeDue(value:number){
  const diff=value-Date.now();
  if(diff<=0)return "revisar agora";
  const days=Math.ceil(diff/86400000);
  return days===1?"amanhã":"em "+days+" dias";
}

export default function ChibiLessons({playerKey,onEvidence}:Props){
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1);
    window.addEventListener("chibi:lessons-change",refresh);
    return ()=>window.removeEventListener("chibi:lessons-change",refresh);
  },[]);

  const lessons=useMemo(()=>{
    void version;
    return getLessons(playerKey);
  },[playerKey,version]);

  const due=useMemo(()=>{
    void version;
    return getDueLessons(playerKey);
  },[playerKey,version]);

  function review(lesson:ChibiLesson){
    markLessonReviewed(lesson.id);
    setVersion(value=>value+1);
  }

  function archive(lesson:ChibiLesson){
    archiveLesson(lesson.id);
    setVersion(value=>value+1);
  }

  if(!lessons.length)return <section className="lessons-empty">
    <span>CHIBI LESSONS</span>
    <strong>Suas revisões ainda não viraram lições salvas.</strong>
    <p>Abra uma partida, escreva no Journal o que você aprendeu e salve a nota como lição.</p>
  </section>;

  return <section className="chibi-lessons">
    <div className="lessons-head">
      <div>
        <span>CHIBI LESSONS</span>
        <h3>Coisas que você decidiu não esquecer</h3>
        <p>As lições vêm das suas próprias notas e reaparecem em intervalos crescentes conforme você confirma que ainda fazem sentido.</p>
      </div>
      <div className="lessons-count">
        <small>PARA REVISAR</small>
        <strong>{due.length}</strong>
        <span>{lessons.length} salva{lessons.length===1?"":"s"}</span>
      </div>
    </div>

    <div className="lessons-list">
      {lessons.slice(0,6).map(lesson=>{
        const isDue=lessonDueAt(lesson)<=Date.now();
        return <article className={isDue?"due":""} key={lesson.id}>
          <div className="lesson-copy">
            <span>{isDue?"REVISAR AGORA":"MEMÓRIA ATIVA"}</span>
            <blockquote>{lesson.text}</blockquote>
            <small>
              {lesson.reviewCount===0
                ?"ainda não revisada"
                :lesson.reviewCount+" revisão"+(lesson.reviewCount===1?"":"ões")}
              {" · "+relativeDue(lessonDueAt(lesson))}
            </small>
          </div>

          <div className="lesson-actions">
            <button onClick={()=>onEvidence([lesson.matchId],"Chibi Lesson · partida de origem")}>Partida</button>
            <button className="primary" onClick={()=>review(lesson)}>Ainda faz sentido</button>
            <button className="ghost" onClick={()=>archive(lesson)}>Já aprendi</button>
          </div>
        </article>;
      })}
    </div>

    <p className="lessons-note">Revisar uma lição não prova melhoria no jogo; é apenas uma forma de manter decisões e aprendizados importantes visíveis por mais tempo.</p>
  </section>;
}
