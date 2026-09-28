import { useEffect, useMemo, useState } from "react";
import { getStudyShelf, removeStudyShelfItem } from "../studyShelf";

type Props={
  onOpenBuilder:(unitIds:string[])=>void;
  onOpenStats:(category:"champions"|"traits"|"items"|"augments",query:string)=>void;
};

export default function HomeStudyShelf({onOpenBuilder,onOpenStats}:Props){
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1);
    window.addEventListener("chibi:study-shelf-change",refresh);
    return ()=>window.removeEventListener("chibi:study-shelf-change",refresh);
  },[]);

  const items=useMemo(()=>{
    void version;
    return getStudyShelf().slice(0,6);
  },[version]);

  if(!items.length)return null;

  return <section className="home-study-shelf">
    <div className="study-shelf-head">
      <div>
        <span>STUDY SHELF</span>
        <strong>Coisas que você decidiu revisar depois</strong>
      </div>
      <small>{items.length} salvo{items.length===1?"":"s"}</small>
    </div>

    <div className="study-shelf-list">
      {items.map(item=>(
        <article key={item.id}>
          <button
            className="study-shelf-open"
            onClick={()=>{
              if(item.type==="comp")onOpenBuilder(item.unitIds);
              else onOpenStats(item.category,item.entityId);
            }}
          >
            <span className={"study-shelf-type "+item.type}>{item.type==="comp"?"C":"S"}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.subtitle}</small>
            </span>
            <b>{item.type==="comp"?"Builder":"Statistics"} →</b>
          </button>
          <button
            className="study-shelf-remove"
            onClick={()=>removeStudyShelfItem(item.id)}
            aria-label={"Remover "+item.label+" do Study Shelf"}
          >×</button>
        </article>
      ))}
    </div>
  </section>;
}
