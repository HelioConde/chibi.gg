import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type Mode="login"|"signup";

export default function AccountMenu(){
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
    try{ await supabase.auth.signOut(); setOpen(false); }
    finally{ setBusy(false); }
  }

  const userLabel=session?.user?.email||"Conta";

  return <div style={{position:"relative"}}>
    <button
      className="ghost-button"
      onClick={()=>setOpen(value=>!value)}
      aria-expanded={open}
      title={session?"Conta Chibi":"Entrar no Chibi"}
    >
      {session?"● "+userLabel.split("@")[0]:"Conta"}
    </button>

    {open&&<div
      role="dialog"
      aria-label="Conta Chibi"
      style={{
        position:"absolute",
        right:0,
        top:"calc(100% + 12px)",
        width:320,
        maxWidth:"calc(100vw - 28px)",
        zIndex:80,
        padding:18,
        border:"1px solid #2a3042",
        borderRadius:14,
        background:"#101522",
        boxShadow:"0 18px 55px rgba(0,0,0,.45)",
      }}
    >
      {session?<>
        <div style={{display:"grid",gap:8}}>
          <strong>Conta Chibi</strong>
          <small style={{color:"#9ca5b8",wordBreak:"break-all"}}>{session.user.email}</small>
          <small style={{color:"#7f8aa3"}}>Seu Companion poderá usar esta conta para enviar partidas gravadas após o jogo.</small>
          <button className="ghost-button" disabled={busy} onClick={logout} style={{marginLeft:0}}>
            Sair
          </button>
        </div>
      </>:<>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button
            className={mode==="login"?"ghost-button active":"ghost-button"}
            onClick={()=>{setMode("login");setMessage("");}}
            type="button"
            style={{marginLeft:0,flex:1}}
          >Entrar</button>
          <button
            className={mode==="signup"?"ghost-button active":"ghost-button"}
            onClick={()=>{setMode("signup");setMessage("");}}
            type="button"
            style={{marginLeft:0,flex:1}}
          >Criar conta</button>
        </div>

        <form onSubmit={submit} style={{display:"grid",gap:10}}>
          <label style={{display:"grid",gap:5,fontSize:12,color:"#aab2c4"}}>
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event=>setEmail(event.target.value)}
              style={{padding:"10px 11px",borderRadius:9,border:"1px solid #2a3042",background:"#0b0f19",color:"#f5f7ff"}}
            />
          </label>
          <label style={{display:"grid",gap:5,fontSize:12,color:"#aab2c4"}}>
            Senha
            <input
              type="password"
              autoComplete={mode==="signup"?"new-password":"current-password"}
              required
              minLength={8}
              value={password}
              onChange={event=>setPassword(event.target.value)}
              style={{padding:"10px 11px",borderRadius:9,border:"1px solid #2a3042",background:"#0b0f19",color:"#f5f7ff"}}
            />
          </label>
          <button className="ghost-button" disabled={busy} type="submit" style={{marginLeft:0}}>
            {busy?"Aguarde...":mode==="signup"?"Criar conta":"Entrar"}
          </button>
        </form>
        {message&&<small style={{display:"block",marginTop:10,color:"#b8c1d6"}}>{message}</small>}
      </>}
    </div>}
  </div>;
}
