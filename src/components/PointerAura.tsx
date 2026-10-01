import { useEffect, useRef } from "react";

const REACTIVE_SELECTOR=[
  ".match-row-v2",
  ".comp-decision-card",
  ".statistics-quick-card",
  ".tier-entity",
  ".leaderboard-table article",
  ".home-visual-card",
  ".profile-insight-card",
  ".match-detail-layer",
  ".coach-secondary-panel",
  ".coach-strategy-layer",
  ".builder-decision-card",
  ".comp-row",
  ".global-meta-card",
  ".panel",
].join(",");

export default function PointerAura(){
  const auraRef=useRef<HTMLDivElement|null>(null);
  const coreRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    const fine=window.matchMedia("(pointer:fine)");
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(!fine.matches||reduced.matches)return;

    let frame=0;
    let x=-100,y=-100;
    let active:HTMLElement|null=null;

    const draw=()=>{
      frame=0;
      auraRef.current?.style.setProperty("transform",`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`);
      coreRef.current?.style.setProperty("transform",`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`);
    };

    const onMove=(event:PointerEvent)=>{
      x=event.clientX;
      y=event.clientY;
      if(!frame)frame=requestAnimationFrame(draw);

      const next=(event.target as HTMLElement|null)?.closest(REACTIVE_SELECTOR) as HTMLElement|null;
      if(active!==next){
        active?.classList.remove("hud-reactive-hover");
        active=next;
        active?.classList.add("hud-reactive-hover");
      }
      if(active){
        const rect=active.getBoundingClientRect();
        active.style.setProperty("--hud-mx",`${event.clientX-rect.left}px`);
        active.style.setProperty("--hud-my",`${event.clientY-rect.top}px`);
      }

      const interactive=Boolean((event.target as HTMLElement|null)?.closest("button,a,input,select,textarea,[role=button]"));
      auraRef.current?.classList.toggle("interactive",interactive);
      coreRef.current?.classList.toggle("interactive",interactive);
      document.documentElement.style.setProperty("--pointer-x",`${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y",`${event.clientY}px`);
    };

    const onDown=()=>{
      auraRef.current?.classList.add("down");
      coreRef.current?.classList.add("down");
    };
    const onUp=()=>{
      auraRef.current?.classList.remove("down");
      coreRef.current?.classList.remove("down");
    };
    const onLeave=()=>{
      auraRef.current?.classList.add("hidden");
      coreRef.current?.classList.add("hidden");
      active?.classList.remove("hud-reactive-hover");
      active=null;
    };
    const onEnter=()=>{
      auraRef.current?.classList.remove("hidden");
      coreRef.current?.classList.remove("hidden");
    };

    window.addEventListener("pointermove",onMove,{passive:true});
    window.addEventListener("pointerdown",onDown,{passive:true});
    window.addEventListener("pointerup",onUp,{passive:true});
    document.documentElement.addEventListener("mouseleave",onLeave);
    document.documentElement.addEventListener("mouseenter",onEnter);

    return ()=>{
      if(frame)cancelAnimationFrame(frame);
      active?.classList.remove("hud-reactive-hover");
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerdown",onDown);
      window.removeEventListener("pointerup",onUp);
      document.documentElement.removeEventListener("mouseleave",onLeave);
      document.documentElement.removeEventListener("mouseenter",onEnter);
    };
  },[]);

  return <>
    <div ref={auraRef} className="pointer-aura hidden" aria-hidden="true"/>
    <div ref={coreRef} className="pointer-core hidden" aria-hidden="true"/>
  </>;
}
