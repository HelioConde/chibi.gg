import { useEffect, useMemo, useState } from "react";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { availableMonitors, getCurrentWindow, Monitor } from "@tauri-apps/api/window";
import { DEMO_FRAMES, demoFrame } from "./live/demoProvider";
import { frameFromSnapshot } from "./live/decisionEngine";
import { LiveSnapshot, OverlayStateId } from "./live/types";
import { addSessionMarker, getSessionMarkers } from "./sessionStore";

type PresetId="compact"|"coach"|"full";
type CornerId="top-left"|"top-right";

const PRESETS:Record<PresetId,{label:string;width:number;height:number;compact:boolean}>={
  compact:{label:"Compacto",width:410,height:390,compact:true},
  coach:{label:"Coach",width:470,height:650,compact:false},
  full:{label:"Completo",width:620,height:740,compact:false},
};

const SETTINGS_KEY="chibi-companion:window:v1";

function isTauri(){
  return "__TAURI_INTERNALS__" in window;
}

export default function App(){
  const [stateId,setStateId]=useState<OverlayStateId>("weak");
  const [source,setSource]=useState<"demo"|"manual">("demo");
  const [manualSnapshot,setManualSnapshot]=useState<LiveSnapshot>({
    source:"manual",
    capturedAt:Date.now(),
    stage:"3-2",
    hp:70,
    gold:40,
    level:6,
    streak:"L1",
    boardStrength:55,
    contestants:0,
    upgradePairs:1,
    frontlineReady:true,
  });
  const [preset,setPreset]=useState<PresetId>("coach");
  const [corner,setCorner]=useState<CornerId>("top-left");
  const [monitors,setMonitors]=useState<Monitor[]>([]);
  const [monitorIndex,setMonitorIndex]=useState(0);
  const [locked,setLocked]=useState(false);
  const [alwaysOnTop,setAlwaysOnTopState]=useState(true);
  const [notice,setNotice]=useState("Ctrl+Shift+Space mostra/oculta · Ctrl+Shift+L libera o mouse");
  const [markerCount,setMarkerCount]=useState(()=>getSessionMarkers().length);

  const frame=useMemo(
    ()=>source==="demo"
      ? demoFrame(stateId)
      : frameFromSnapshot({...manualSnapshot,capturedAt:Date.now()}),
    [source,stateId,manualSnapshot],
  );
  const snapshot=frame.snapshot;
  const decision=frame.decision;
  const compact=PRESETS[preset].compact;

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(SETTINGS_KEY);
      const saved=raw?JSON.parse(raw):null;
      if(saved?.preset&&PRESETS[saved.preset as PresetId]) setPreset(saved.preset);
      if(saved?.corner==="top-left"||saved?.corner==="top-right") setCorner(saved.corner);
      if(Number.isInteger(saved?.monitorIndex)) setMonitorIndex(Math.max(0,saved.monitorIndex));
    }catch{}

    if(isTauri()){
      availableMonitors()
        .then(list=>setMonitors(list))
        .catch(()=>setMonitors([]));
    }
  },[]);

  async function toggleAlwaysOnTop(){
    const next=!alwaysOnTop;
    setAlwaysOnTopState(next);
    if(isTauri()){
      await getCurrentWindow().setAlwaysOnTop(next);
    }
  }

  function persistWindow(nextPreset:PresetId,nextCorner:CornerId,nextMonitor:number){
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({
      preset:nextPreset,
      corner:nextCorner,
      monitorIndex:nextMonitor,
    }));
  }

  async function applyWindowLayout(
    nextPreset:PresetId=preset,
    nextCorner:CornerId=corner,
    nextMonitor:number=monitorIndex,
  ){
    setPreset(nextPreset);
    setCorner(nextCorner);
    setMonitorIndex(nextMonitor);
    persistWindow(nextPreset,nextCorner,nextMonitor);

    if(!isTauri()) return;

    const appWindow=getCurrentWindow();
    const config=PRESETS[nextPreset];
    await appWindow.setSize(new LogicalSize(config.width,config.height));

    const list=monitors.length?monitors:await availableMonitors();
    const monitor=list[Math.min(nextMonitor,Math.max(0,list.length-1))];
    if(!monitor) return;

    const workPosition=monitor.workArea.position.toLogical(monitor.scaleFactor);
    const workSize=monitor.workArea.size.toLogical(monitor.scaleFactor);
    const margin=18;
    const x=nextCorner==="top-right"
      ? workPosition.x+workSize.width-config.width-margin
      : workPosition.x+margin;
    const y=workPosition.y+margin;

    await appWindow.setPosition(new LogicalPosition(Math.max(workPosition.x,x),Math.max(workPosition.y,y)));
  }

  function markSnapshot(){
    const next=addSessionMarker(frame);
    setMarkerCount(next.length);
    setNotice("Snapshot marcado para revisão · "+(snapshot.stage||"stage desconhecido"));
  }

  async function enableClickThrough(){
    if(!isTauri()){
      setNotice("Click-through só funciona no app desktop.");
      return;
    }
    setNotice("Mouse será liberado em 1s. Use Ctrl+Shift+L para voltar a interagir.");
    window.setTimeout(async()=>{
      await getCurrentWindow().setIgnoreCursorEvents(true);
      setLocked(true);
    },1000);
  }

  return <div className={"companion-root preset-"+preset+" "+(compact?"compact ":"")+"tone-"+decision.tone}>
    <section className="companion-card">
      <header className="companion-head" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <span data-tauri-drag-region>c</span>
          <div data-tauri-drag-region>
            <strong data-tauri-drag-region>Chibi Overlay</strong>
            <small data-tauri-drag-region>{source==="demo"?"GM1.2 · demo local":"GM1.3 · provider manual"}</small>
          </div>
        </div>
        <div className="live"><i/> {source==="demo"?"DEMO":"MANUAL"}</div>
      </header>

      <div className="state-strip">
        <div><span>STAGE</span><strong>{snapshot.stage??"—"}</strong></div>
        <div><span>HP</span><strong>{snapshot.hp??"—"}</strong></div>
        <div><span>GOLD</span><strong>{snapshot.gold??"—"}</strong></div>
        <div><span>LVL</span><strong>{snapshot.level??"—"}</strong></div>
        {!compact&&<div><span>STREAK</span><strong>{snapshot.streak??"—"}</strong></div>}
      </div>

      <div className="board-status">
        <div><span>ESTADO</span><strong>{decision.boardStatus}</strong></div>
        <b>{decision.boardScore??"—"}</b>
      </div>

      <article className="do-now">
        <span>FAÇA AGORA</span>
        <h1>{decision.title}</h1>
        <ol>
          {decision.actions.slice(0,compact?2:3).map((action,index)=>(
            <li key={action}><b>{index+1}</b><p>{action}</p></li>
          ))}
        </ol>
      </article>

      {!compact&&<div className="secondary-grid">
        <article className="problem">
          <span>O QUE ESTÁ DANDO ERRADO</span>
          <h2>{decision.mainProblem}</h2>
          <ul>{decision.secondarySignals.map(signal=><li key={signal}>{signal}</li>)}</ul>
        </article>
        <article className="spike">
          <span>PRÓXIMO SPIKE</span>
          <strong>{decision.nextSpike}</strong>
        </article>
      </div>}

      <footer className="companion-controls">
        <div className="source-tabs">
          <button className={source==="demo"?"active":""} onClick={()=>setSource("demo")}>Demo</button>
          <button className={source==="manual"?"active":""} onClick={()=>setSource("manual")}>Manual</button>
        </div>

        {source==="demo"?<div className="scenario-tabs">
          {DEMO_FRAMES.map(item=>(
            <button
              className={item.id===stateId?"active":""}
              onClick={()=>setStateId(item.id)}
              key={item.id}
            >{item.label}</button>
          ))}
        </div>:!compact&&<div className="manual-provider">
          <label><span>Stage</span><input value={manualSnapshot.stage||""} onChange={event=>setManualSnapshot(current=>({...current,stage:event.target.value}))}/></label>
          <label><span>HP</span><input type="number" min="0" max="100" value={manualSnapshot.hp??0} onChange={event=>setManualSnapshot(current=>({...current,hp:Number(event.target.value)}))}/></label>
          <label><span>Gold</span><input type="number" min="0" max="200" value={manualSnapshot.gold??0} onChange={event=>setManualSnapshot(current=>({...current,gold:Number(event.target.value)}))}/></label>
          <label><span>Level</span><input type="number" min="1" max="10" value={manualSnapshot.level??1} onChange={event=>setManualSnapshot(current=>({...current,level:Number(event.target.value)}))}/></label>
          <label><span>Força</span><input type="range" min="0" max="100" value={manualSnapshot.boardStrength??60} onChange={event=>setManualSnapshot(current=>({...current,boardStrength:Number(event.target.value)}))}/><b>{manualSnapshot.boardStrength??60}</b></label>
          <label><span>Contest</span><input type="number" min="0" max="7" value={manualSnapshot.contestants??0} onChange={event=>setManualSnapshot(current=>({...current,contestants:Number(event.target.value)}))}/></label>
          <label><span>Pares</span><input type="number" min="0" max="9" value={manualSnapshot.upgradePairs??0} onChange={event=>setManualSnapshot(current=>({...current,upgradePairs:Number(event.target.value)}))}/></label>
          <label className="toggle"><span>Frontline pronta</span><input type="checkbox" checked={manualSnapshot.frontlineReady!==false} onChange={event=>setManualSnapshot(current=>({...current,frontlineReady:event.target.checked}))}/></label>
        </div>}

        <div className="preset-actions">
          {(Object.keys(PRESETS) as PresetId[]).map(id=>(
            <button
              className={preset===id?"active":""}
              onClick={()=>void applyWindowLayout(id,corner,monitorIndex)}
              key={id}
            >{PRESETS[id].label}</button>
          ))}
        </div>

        {!compact&&<div className="layout-actions">
          <select
            value={monitorIndex}
            onChange={event=>void applyWindowLayout(preset,corner,Number(event.target.value))}
            aria-label="Monitor"
          >
            {(monitors.length?monitors:[{name:"Monitor principal"} as Monitor]).map((monitor,index)=>(
              <option value={index} key={index}>{monitor.name||"Monitor "+(index+1)}</option>
            ))}
          </select>
          <button className={corner==="top-left"?"active":""} onClick={()=>void applyWindowLayout(preset,"top-left",monitorIndex)}>↖ Esquerda</button>
          <button className={corner==="top-right"?"active":""} onClick={()=>void applyWindowLayout(preset,"top-right",monitorIndex)}>Direita ↗</button>
        </div>}

        <div className="window-actions">
          <button className="marker-button" onClick={markSnapshot}>Marcar snapshot <b>{markerCount}</b></button>
          <button className={alwaysOnTop?"active":""} onClick={()=>void toggleAlwaysOnTop()}>Always on top</button>
          <button onClick={()=>void enableClickThrough()}>Liberar mouse</button>
        </div>

        <small>{locked?"Click-through ativo · Ctrl+Shift+L para desbloquear":notice}</small>
      </footer>
    </section>
  </div>;
}
