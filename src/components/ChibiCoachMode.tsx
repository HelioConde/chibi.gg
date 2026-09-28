import { useEffect, useState } from "react";

type CoachMode="essential"|"advanced";

const KEY="chibi.gg:coach-mode:v1";

function readMode():CoachMode{
  try{
    return localStorage.getItem(KEY)==="advanced"?"advanced":"essential";
  }catch{
    return "essential";
  }
}

export default function ChibiCoachMode(){
  const [mode,setMode]=useState<CoachMode>(()=>readMode());

  useEffect(()=>{
    document.body.dataset.chibiCoachMode=mode;
    try{localStorage.setItem(KEY,mode);}catch{}
    return ()=>{
      delete document.body.dataset.chibiCoachMode;
    };
  },[mode]);

  return <section className="coach-mode-switch" aria-label="Profundidade do Chibi Coach">
    <div>
      <span>PROFUNDIDADE</span>
      <strong>{mode==="essential"?"Essencial":"Avançado"}</strong>
      <small>{mode==="essential"
        ?"Só o que muda sua próxima partida."
        :"Dataset, packages, memória e sinais secundários."}</small>
    </div>
    <div className="coach-mode-buttons">
      <button className={mode==="essential"?"active":""} onClick={()=>setMode("essential")}>
        Essencial
      </button>
      <button className={mode==="advanced"?"active":""} onClick={()=>setMode("advanced")}>
        Avançado
      </button>
    </div>
  </section>;
}
