import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { useI18n } from "../i18n";

type Mode="login"|"signup";

type Props={
  riotGameName?:string;
  riotTagLine?:string;
  riotProfileIcon?:string;
  initiallyOpen?:boolean;
};

export default function AccountMenu({
  riotGameName,
  riotTagLine,
  riotProfileIcon,
  initiallyOpen=false,
}:Props){
  const { language } = useI18n();
  const label=(pt:string,en:string)=>language==="en"?en:pt;
  const [session,setSession]=useState<Session|null>(null);
  const rootRef=useRef<HTMLDivElement|null>(null);
  const triggerRef=useRef<HTMLButtonElement|null>(null);
  const [open,setOpen]=useState(initiallyOpen);
  const [mode,setMode]=useState<Mode>("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    void supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!rootRef.current?.contains(event.target)){
        setOpen(false);
      }
    };
    document.addEventListener("keydown",onKey);
    document.addEventListener("pointerdown",onPointerDown);
    return ()=>{
      document.removeEventListener("keydown",onKey);
      document.removeEventListener("pointerdown",onPointerDown);
    };
  },[open]);

  async function submit(event:FormEvent){
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try{
      if(mode==="signup"){
        const redirect=new URL(window.location.href);
        redirect.search="";
        redirect.hash="";
        const {data,error}=await supabase.auth.signUp({
          email,
          password,
          options:{emailRedirectTo:redirect.toString()},
        });
        if(error)throw error;
        if(data.session){
          setMessage(label("Conta criada e conectada.","Account created and connected."));
          setOpen(false);
        }else{
          setMessage(label("Conta criada. Confirme o e-mail para entrar.","Account created. Confirm your email to sign in."));
        }
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        setOpen(false);
      }
    }catch(error){
      setMessage(error instanceof Error?error.message:label("Não foi possível autenticar.","Could not sign in."));
    }finally{
      setBusy(false);
    }
  }

  async function logout(){
    setBusy(true);
    try{
      await supabase.auth.signOut({scope:"global"});
      setOpen(false);
    }finally{
      setBusy(false);
    }
  }

  const hasRiotIdentity=Boolean(riotGameName);
  const primaryLabel=riotGameName|| (session?label("Minha conta","My account"):label("Entrar","Sign in"));
  const secondaryLabel=hasRiotIdentity
    ? (riotTagLine?"#"+riotTagLine:"Riot ID")
    : (session?label("Chibi conectado","Chibi connected"):label("Conta Chibi","Chibi account"));

  return <div className="account-menu" ref={rootRef}>
    <button
      ref={triggerRef}
      className={"account-menu-trigger"+(hasRiotIdentity?" has-riot-id":"")}
      onClick={()=>setOpen(value=>!value)}
      aria-expanded={open}
      aria-controls="chibi-account-menu"
      aria-haspopup="dialog"
      title={hasRiotIdentity
        ? "Riot ID: "+riotGameName+(riotTagLine?"#"+riotTagLine:"")
        : session?label("Conta Chibi","Chibi account"):label("Entrar no Chibi","Sign in to Chibi")}
      type="button"
    >
      <span className="account-menu-avatar" aria-hidden="true">
        {riotProfileIcon
          ?<img src={riotProfileIcon} alt="" onError={(event)=>{event.currentTarget.style.display="none";}}/>
          :<span>{primaryLabel.slice(0,1).toUpperCase()}</span>}
      </span>
      <span className="account-menu-copy">
        <strong>{primaryLabel}</strong>
        <small>{secondaryLabel}</small>
      </span>
      <span className="account-menu-chevron" aria-hidden="true">⌄</span>
    </button>

    {open&&<div
      className="account-menu-panel"
      id="chibi-account-menu"
      role="dialog"
      aria-label={label("Conta Chibi","Chibi account")}
    >
      {hasRiotIdentity&&<div className="account-riot-identity">
        <span className="account-riot-avatar" aria-hidden="true">
          {riotProfileIcon
            ?<img src={riotProfileIcon} alt="" onError={(event)=>{event.currentTarget.style.display="none";}}/>
            :riotGameName?.slice(0,1).toUpperCase()}
        </span>
        <span>
          <small>{label("RIOT ID EM USO","ACTIVE RIOT ID")}</small>
          <strong>{riotGameName}<em>{riotTagLine?"#"+riotTagLine:""}</em></strong>
        </span>
      </div>}

      {session?<>
        <div className="account-session-block">
          <span>{label("CONTA CHIBI","CHIBI ACCOUNT")}</span>
          <strong>{session.user.email?.split("@")[0]||label("Conta conectada","Connected account")}</strong>
          <small>{session.user.email}</small>
          <p>{label("Seu Companion pode usar esta conta para enviar partidas gravadas após o jogo.","Your Companion can use this account to upload recorded matches after the game.")}</p>
        </div>
        <button className="ghost-button account-menu-action" disabled={busy} onClick={logout}>
          {busy?label("Saindo...","Signing out..."):label("Sair da conta","Sign out")}
        </button>
      </>:<>
        <div className="account-auth-tabs">
          <button
            className={mode==="login"?"ghost-button active":"ghost-button"}
            onClick={()=>{setMode("login");setMessage("");}}
            type="button"
          >{label("Entrar","Sign in")}</button>
          <button
            className={mode==="signup"?"ghost-button active":"ghost-button"}
            onClick={()=>{setMode("signup");setMessage("");}}
            type="button"
          >{label("Criar conta","Create account")}</button>
        </div>

        <form onSubmit={submit} className="account-auth-form">
          <label>
            <span>{label("E-mail","Email")}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event=>setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>{label("Senha","Password")}</span>
            <input
              type="password"
              autoComplete={mode==="signup"?"new-password":"current-password"}
              required
              minLength={8}
              value={password}
              onChange={event=>setPassword(event.target.value)}
            />
          </label>
          <button className="ghost-button account-menu-action" disabled={busy} type="submit">
            {busy?label("Aguarde...","Please wait..."):mode==="signup"?label("Criar conta","Create account"):label("Entrar","Sign in")}
          </button>
        </form>
        {message&&<small className="account-auth-message" role="status" aria-live="polite">{message}</small>}
      </>}
    </div>}
  </div>;
}
