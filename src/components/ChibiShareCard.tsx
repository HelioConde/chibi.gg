import { useMemo, useState } from "react";
import { TftMatch, TftProfile } from "../api/tft";
import { ChibiDNA } from "../analysis/chibiInsights";
import { buildLeakMap, buildPersonalMeta } from "../analysis/chibiProduct";
import { staticEntry, TftStaticData } from "../tftStatic";

type Props={
  profile:TftProfile;
  dna:ChibiDNA;
  matches:TftMatch[];
  staticData:TftStaticData|null;
  shareUrl:string;
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

export default function ChibiShareCard({profile,dna,matches,staticData,shareUrl}:Props){
  const [copied,setCopied]=useState(false);
  const meta=useMemo(()=>buildPersonalMeta(matches),[matches]);
  const leaks=useMemo(()=>buildLeakMap(matches),[matches]);

  const best=meta[0]||null;
  const leak=leaks.primary||null;

  const text=[
    `chibi.gg · ${profile.player.gameName}#${profile.player.tagLine}`,
    `Média ${dna.avgPlacement??"—"} · Top 4 ${dna.top4Rate}% · Bottom 2 ${dna.bottom2Rate}%`,
    `DNA: consistência ${dna.consistency}% · flexibilidade ${dna.flexibility}% · conversão ${dna.conversion}%`,
    best?`Melhor linha pessoal: ${traitName(best.id,staticData)} · média ${best.avgPlacement}`:"",
    leak?`Principal ponto de investigação: ${leak.title} · ${leak.evidence}`:"",
    shareUrl,
  ].filter(Boolean).join("\n");

  async function copy(){
    try{
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(()=>setCopied(false),1800);
    }catch{
      setCopied(false);
    }
  }

  async function share(){
    const nav=navigator as Navigator & {share?:(data:{title:string;text:string;url:string})=>Promise<void>};
    if(nav.share){
      try{
        await nav.share({
          title:`Chibi Snapshot · ${profile.player.gameName}`,
          text:text.replace(shareUrl,"").trim(),
          url:shareUrl,
        });
        return;
      }catch{}
    }
    await copy();
  }

  return <section className="panel share-card">
    <div className="share-card-head">
      <div>
        <span>CHIBI SNAPSHOT</span>
        <h2>Seu perfil em um card compartilhável</h2>
      </div>
      <div className="share-actions">
        <button onClick={copy}>{copied?"Copiado ✓":"Copiar resumo"}</button>
        <button className="primary" onClick={share}>Compartilhar</button>
      </div>
    </div>

    <div className="snapshot-card">
      <div className="snapshot-identity">
        <div className="snapshot-mark">c</div>
        <div>
          <strong>{profile.player.gameName}<span>#{profile.player.tagLine}</span></strong>
          <small>{profile.player.platform} · {dna.sampleSize} partidas analisadas</small>
        </div>
      </div>

      <div className="snapshot-stats">
        <div><span>Média</span><strong>{dna.avgPlacement??"—"}</strong></div>
        <div><span>Top 4</span><strong>{dna.top4Rate}%</strong></div>
        <div><span>Consistência</span><strong>{dna.consistency}%</strong></div>
        <div><span>Flexibilidade</span><strong>{dna.flexibility}%</strong></div>
      </div>

      <div className="snapshot-findings">
        <div>
          <span>Melhor linha pessoal</span>
          <strong>{best?traitName(best.id,staticData):"Amostra insuficiente"}</strong>
          <small>{best?`média ${best.avgPlacement} · ${best.games} partidas`:"carregue mais histórico"}</small>
        </div>
        <div>
          <span>Principal investigação</span>
          <strong>{leak?.title||"Sem leak dominante"}</strong>
          <small>{leak?.evidence||"nenhum padrão forte na amostra"}</small>
        </div>
      </div>

      <div className="snapshot-footer">
        <span>chibi.gg</span>
        <small>Dados da Riot + análise da amostra carregada</small>
      </div>
    </div>
  </section>;
}
