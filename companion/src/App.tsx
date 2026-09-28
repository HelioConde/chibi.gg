import { useEffect, useMemo, useState } from "react";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { availableMonitors, getCurrentWindow, Monitor } from "@tauri-apps/api/window";

type StateId="stable"|"weak"|"contested"|"spike";
type PresetId="compact"|"coach"|"full";
type CornerId="top-left"|"top-right";

const PRESETS:Record<PresetId,{label:string;width:number;height:number;compact:boolean}>={
  compact:{label:"Compacto",width:410,height:390,compact:true},
  coach:{label:"Coach",width:470,height:650,compact:false},
  full:{label:"Completo",width:620,height:740,compact:false},
};

const SETTINGS_KEY="chibi-companion:window:v1";

type DemoState={
  id:StateId;
  label:string;
  tone:"good"|"warning"|"danger";
  stage:string;
  hp:number;
  gold:number;
  level:number;
  streak:string;
  status:string;
  score:number;
  title:string;
  actions:string[];
  problem:string;
  signals:string[];
  spike:string;
};

const STATES:DemoState[]=[
  {
    id:"stable",label:"Estável",tone:"good",stage:"3-2",hp:82,gold:42,level:6,streak:"W2",
    status:"ESTÁVEL PARA O STAGE",score:72,
    title:"Preserve economia e observe a lobby",
    actions:["Não há necessidade clara de rolar agora.","Complete frontline se aparecer upgrade natural.","Scout antes do 3-5."],
    problem:"Nenhum problema dominante",
    signals:["Economia saudável","Frontline suficiente","Carry ainda precisa de upgrade"],
    spike:"Level 7 · 4-1 / 4-2",
  },
  {
    id:"weak",label:"Fraco",tone:"danger",stage:"3-2",hp:61,gold:36,level:6,streak:"L3",
    status:"FRACO PARA O STAGE",score:39,
    title:"Estabilize antes de continuar greedando",
    actions:["Transforme pares em upgrades.","Se perder forte de novo, gaste parte do ouro.","Melhore frontline antes da transição completa."],
    problem:"Frontline abaixo do necessário",
    signals:["2 pares sem upgrade","HP caindo rápido","Carry pronto, tanque atrasado"],
    spike:"Estabilização · 10–20g",
  },
  {
    id:"contested",label:"Contestado",tone:"warning",stage:"4-1",hp:54,gold:31,level:7,streak:"L1",
    status:"LINHA MUITO CONTESTADA",score:58,
    title:"Pare antes de comprometer todo o ouro",
    actions:["Dois rivais compartilham peças centrais.","Compare sua rota alternativa.","Mantenha duas saídas para os mesmos itens."],
    problem:"Peças centrais divididas na lobby",
    signals:["2 rivais diretos","Carry disputado","Frontline compartilhada"],
    spike:"Decisão de pivot · antes do rolldown",
  },
  {
    id:"spike",label:"Spike",tone:"good",stage:"4-2",hp:67,gold:18,level:8,streak:"W3",
    status:"PICO DE FORÇA ATIVO",score:86,
    title:"Consolide o board que já funciona",
    actions:["Evite desmontar a estrutura atual.","Busque upgrades específicos.","Scout para ajustar posicionamento."],
    problem:"Risco principal: over-roll",
    signals:["Board estabilizado","Economia baixa após spike","Cap vem de upgrades pontuais"],
    spike:"Cap de board · upgrades + posição",
  },
];

function isTauri(){
  return "__TAURI_INTERNALS__" in window;
}

export default function App(){
  const [stateId,setStateId]=useState<StateId>("weak");
  const [preset,setPreset]=useState<PresetId>("coach");
  const [corner,setCorner]=useState<CornerId>("top-left");
  const [monitors,setMonitors]=useState<Monitor[]>([]);
  const [monitorIndex,setMonitorIndex]=useState(0);
  const [locked,setLocked]=useState(false);
  const [alwaysOnTop,setAlwaysOnTopState]=useState(true);
  const [notice,setNotice]=useState("Ctrl+Shift+Space mostra/oculta · Ctrl+Shift+L libera o mouse");

  const state=useMemo(()=>STATES.find(item=>item.id===stateId)!,[stateId]);
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

  return <div className={"companion-root preset-"+preset+" "+(compact?"compact ":"")+"tone-"+state.tone}>
    <section className="companion-card">
      <header className="companion-head" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <span data-tauri-drag-region>c</span>
          <div data-tauri-drag-region>
            <strong data-tauri-drag-region>Chibi Overlay</strong>
            <small data-tauri-drag-region>GM1.2 · demo local</small>
          </div>
        </div>
        <div className="live"><i/> DEMO</div>
      </header>

      <div className="state-strip">
        <div><span>STAGE</span><strong>{state.stage}</strong></div>
        <div><span>HP</span><strong>{state.hp}</strong></div>
        <div><span>GOLD</span><strong>{state.gold}</strong></div>
        <div><span>LVL</span><strong>{state.level}</strong></div>
        {!compact&&<div><span>STREAK</span><strong>{state.streak}</strong></div>}
      </div>

      <div className="board-status">
        <div><span>ESTADO</span><strong>{state.status}</strong></div>
        <b>{state.score}</b>
      </div>

      <article className="do-now">
        <span>FAÇA AGORA</span>
        <h1>{state.title}</h1>
        <ol>
          {state.actions.slice(0,compact?2:3).map((action,index)=>(
            <li key={action}><b>{index+1}</b><p>{action}</p></li>
          ))}
        </ol>
      </article>

      {!compact&&<div className="secondary-grid">
        <article className="problem">
          <span>O QUE ESTÁ DANDO ERRADO</span>
          <h2>{state.problem}</h2>
          <ul>{state.signals.map(signal=><li key={signal}>{signal}</li>)}</ul>
        </article>
        <article className="spike">
          <span>PRÓXIMO SPIKE</span>
          <strong>{state.spike}</strong>
        </article>
      </div>}

      <footer className="companion-controls">
        <div className="scenario-tabs">
          {STATES.map(item=>(
            <button
              className={item.id===stateId?"active":""}
              onClick={()=>setStateId(item.id)}
              key={item.id}
            >{item.label}</button>
          ))}
        </div>

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
          <button className={alwaysOnTop?"active":""} onClick={()=>void toggleAlwaysOnTop()}>Always on top</button>
          <button onClick={()=>void enableClickThrough()}>Liberar mouse</button>
        </div>

        <small>{locked?"Click-through ativo · Ctrl+Shift+L para desbloquear":notice}</small>
      </footer>
    </section>
  </div>;
}
