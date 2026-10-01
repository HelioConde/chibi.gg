import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type Mode="login"|"signup";

type Props={
  riotGameName?:string;
  riotTagLine?:string;
  riotProfileIcon?:string;
};

export default function AccountMenu({
  riotGameName,
  riotTagLine,
  riotProfileIcon,
}:Props){
  const [session,setSession]=useState<Session|null>(null);
  const [open,setOpen]=useState(false);
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
          setMessage("Conta criada e conectada.");
          setOpen(false);
        }else{
          setMessage("Conta criada. Confirme o e-mail para entrar.");
        }
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        setOpen(false);
      }
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível autenticar.");
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
  const primaryLabel=riotGameName|| (session?"Minha conta":"Entrar");
  const secondaryLabel=hasRiotIdentity
    ? (riotTagLine?"#"+riotTagLine:"Riot ID")
    : (session?"Chibi conectado":"Conta Chibi");

  return <div className="account-menu">
    <button
      className={"account-menu-trigger"+(hasRiotIdentity?" has-riot-id":"")}
      onClick={()=>setOpen(value=>!value)}
      aria-expanded={open}
      title={hasRiotIdentity
        ? "Riot ID: "+riotGameName+(riotTagLine?"#"+riotTagLine:"")
        : session?"Conta Chibi":"Entrar no Chibi"}
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
      role="dialog"
      aria-label="Conta Chibi"
    >
      {hasRiotIdentity&&<div className="account-riot-identity">
        <span className="account-riot-avatar" aria-hidden="true">
          {riotProfileIcon
            ?<img src={riotProfileIcon} alt="" onError={(event)=>{event.currentTarget.style.display="none";}}/>
            :riotGameName?.slice(0,1).toUpperCase()}
        </span>
        <span>
          <small>RIOT ID EM USO</small>
          <strong>{riotGameName}<em>{riotTagLine?"#"+riotTagLine:""}</em></strong>
        </span>
      </div>}

      {session?<>
        <div className="account-session-block">
          <span>CONTA CHIBI</span>
          <strong>{session.user.email?.split("@")[0]||"Conta conectada"}</strong>
          <small>{session.user.email}</small>
          <p>Seu Companion pode usar esta conta para enviar partidas gravadas após o jogo.</p>
        </div>
        <button className="ghost-button account-menu-action" disabled={busy} onClick={logout}>
          {busy?"Saindo...":"Sair da conta"}
        </button>
      </>:<>
        <div className="account-auth-tabs">
          <button
            className={mode==="login"?"ghost-button active":"ghost-button"}
            onClick={()=>{setMode("login");setMessage("");}}
            type="button"
          >Entrar</button>
          <button
            className={mode==="signup"?"ghost-button active":"ghost-button"}
            onClick={()=>{setMode("signup");setMessage("");}}
            type="button"
          >Criar conta</button>
        </div>

        <form onSubmit={submit} className="account-auth-form">
          <label>
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event=>setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Senha</span>
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
            {busy?"Aguarde...":mode==="signup"?"Criar conta":"Entrar"}
          </button>
        </form>
        {message&&<small className="account-auth-message">{message}</small>}
      </>}
    </div>}
  </div>;
}
