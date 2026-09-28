import { useState } from "react";

type Props={
  playerName:string;
  existingReply?:string;
};

export default function ChibiStudyReply({playerName,existingReply=""}:Props){
  const [reviewer,setReviewer]=useState("");
  const [reply,setReply]=useState("");
  const [copied,setCopied]=useState(false);

  function buildUrl(){
    const url=new URL(window.location.href);
    url.searchParams.set("reply",reply.trim().slice(0,320));
    if(reviewer.trim())url.searchParams.set("reviewer",reviewer.trim().slice(0,32));
    else url.searchParams.delete("reviewer");
    return url.toString();
  }

  async function copy(){
    if(!reply.trim())return;
    try{
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1800);
    }catch{
      setCopied(false);
    }
  }

  async function share(){
    if(!reply.trim())return;
    const url=buildUrl();
    const nav=navigator as Navigator & {share?:(data:{title:string;text:string;url:string})=>Promise<void>};
    if(nav.share){
      try{
        await nav.share({
          title:"Chibi Study Reply · "+playerName,
          text:reply.trim(),
          url,
        });
        return;
      }catch{}
    }
    await copy();
  }

  return <section className="study-reply-card">
    <div className="study-reply-head">
      <div>
        <span>STUDY REPLY</span>
        <strong>{existingReply?"Envie outra leitura":"Dê uma segunda opinião"}</strong>
        <small>A resposta viaja no link. Não precisa de conta nem fica pública no Chibi.</small>
      </div>
    </div>

    <div className="study-reply-form">
      <input
        value={reviewer}
        onChange={event=>setReviewer(event.target.value)}
        maxLength={32}
        placeholder="Seu nome ou nick (opcional)"
      />
      <textarea
        value={reply}
        onChange={event=>setReply(event.target.value)}
        maxLength={320}
        placeholder="Ex.: eu revisaria o 4-2. Com esse ouro e esse board, estabilizar antes parecia mais seguro..."
      />
      <div className="study-reply-footer">
        <small>{reply.length}/320</small>
        <div>
          <button disabled={!reply.trim()} onClick={copy}>{copied?"Link copiado ✓":"Copiar resposta"}</button>
          <button className="primary" disabled={!reply.trim()} onClick={share}>Enviar Study Reply</button>
        </div>
      </div>
    </div>
  </section>;
}
