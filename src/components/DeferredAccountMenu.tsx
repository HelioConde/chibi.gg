import { lazy, Suspense, useEffect, useState } from "react";
import { useI18n } from "../i18n";

const AccountMenu=lazy(()=>import("./AccountMenu"));

type Props={
  riotGameName?:string;
  riotTagLine?:string;
  riotProfileIcon?:string;
};

export default function DeferredAccountMenu(props:Props){
  const {language}=useI18n();
  const [ready,setReady]=useState(false);
  const [openOnLoad,setOpenOnLoad]=useState(false);

  useEffect(()=>{
    // Auth is not needed to render the public landing page or search Riot IDs.
    // Initialize it during idle time, or immediately on account interaction.
    let idleId:number|undefined;
    const timer=window.setTimeout(()=>{
      if("requestIdleCallback" in window){
        idleId=window.requestIdleCallback(()=>setReady(true),{timeout:2000});
      }else setReady(true);
    },3500);
    return ()=>{
      window.clearTimeout(timer);
      if(idleId!==undefined&&"cancelIdleCallback" in window)window.cancelIdleCallback(idleId);
    };
  },[]);

  const text=language==="en"?"Chibi account":"Conta Chibi";

  if(!ready){
    return <div className="account-menu">
      <button
        type="button"
        className="account-menu-trigger"
        aria-label={text}
        onClick={()=>{setOpenOnLoad(true);setReady(true);}}
      >
        <span className="account-menu-avatar" aria-hidden="true">
          <span>{props.riotGameName?.slice(0,1).toUpperCase()||"C"}</span>
        </span>
        <span className="account-menu-copy">
          <strong>{props.riotGameName||text}</strong>
          <small>{props.riotTagLine?"#"+props.riotTagLine:text}</small>
        </span>
        <span className="account-menu-chevron" aria-hidden="true">⌄</span>
      </button>
    </div>;
  }

  return <Suspense fallback={<div className="account-menu" aria-live="polite"><span className="account-menu-loading">{language==="en"?"Loading account…":"Carregando conta…"}</span></div>}>
    <AccountMenu {...props} initiallyOpen={openOnLoad}/>
  </Suspense>;
}
