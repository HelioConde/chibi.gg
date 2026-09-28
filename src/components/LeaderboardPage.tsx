import { useEffect, useMemo, useState } from "react";
import {
  fetchTftLeaderboard,
  TftLeaderboard,
  TftLeaderboardPlayer,
} from "../api/tft";
import { profileIconUrl, TftStaticData } from "../tftStatic";

type Tier="challenger"|"grandmaster"|"master";

type Props={
  staticData:TftStaticData|null;
  onOpenPlayer:(player:TftLeaderboardPlayer,platform:string)=>void;
};

const REGIONS=[
  ["br1","BR"],
  ["na1","NA"],
  ["euw1","EUW"],
  ["eun1","EUNE"],
  ["kr","KR"],
  ["jp1","JP"],
  ["la1","LAN"],
  ["la2","LAS"],
] as const;

export default function LeaderboardPage({staticData,onOpenPlayer}:Props){
  const [platform,setPlatform]=useState("br1");
  const [tier,setTier]=useState<Tier>("challenger");
  const [data,setData]=useState<TftLeaderboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftLeaderboard(platform,tier,20)
      .then(result=>{if(!cancelled)setData(result);})
      .catch(err=>{
        if(cancelled)return;
        setData(null);
        setError(err instanceof Error?err.message:"Não foi possível carregar o ranking.");
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[platform,tier]);

  const bestWinRate=useMemo(()=>{
    return data?.players.slice().sort((a,b)=>b.winRate-a.winRate||b.leaguePoints-a.leaguePoints)[0]||null;
  },[data]);

  const mostGames=useMemo(()=>{
    return data?.players.slice().sort((a,b)=>b.games-a.games)[0]||null;
  },[data]);

  return <main className="leaderboard-page">
    <section className="leaderboard-hero">
      <div>
        <span className="eyebrow">TFT LEADERBOARD</span>
        <h1>Quem está no topo.<br/><em>E como joga.</em></h1>
        <p>Ranking oficial de LP da Riot com acesso direto ao perfil Chibi quando o Riot ID pode ser resolvido.</p>
      </div>

      <div className="leaderboard-context">
        <span>REGIÃO</span>
        <strong>{platform.toUpperCase()}</strong>
        <small>{tier}</small>
      </div>
    </section>

    <section className="leaderboard-toolbar">
      <div className="leaderboard-regions">
        {REGIONS.map(([id,label])=>(
          <button className={platform===id?"active":""} onClick={()=>setPlatform(id)} key={id}>{label}</button>
        ))}
      </div>
      <div className="leaderboard-tiers">
        {(["challenger","grandmaster","master"] as Tier[]).map(id=>(
          <button className={tier===id?"active":""} onClick={()=>setTier(id)} key={id}>
            {id==="challenger"?"Challenger":id==="grandmaster"?"Grandmaster":"Master"}
          </button>
        ))}
      </div>
    </section>

    {loading&&<section className="panel meta-page-state">Carregando ranking da Riot...</section>}
    {!loading&&error&&<section className="panel meta-page-state error">Não foi possível carregar o leaderboard agora.</section>}

    {!loading&&!error&&data&&<>
      <section className="leaderboard-highlights">
        <article className="panel">
          <span>#1 LP</span>
          <strong>{data.players[0]?.leaguePoints??"—"}</strong>
          <small>{data.players[0]?.gameName||"Ranqueado #1"}</small>
        </article>
        <article className="panel">
          <span>MAIOR WIN RATE</span>
          <strong>{bestWinRate?bestWinRate.winRate+"%":"—"}</strong>
          <small>{bestWinRate?.gameName||"jogador não identificado"}</small>
        </article>
        <article className="panel">
          <span>MAIS PARTIDAS</span>
          <strong>{mostGames?.games??"—"}</strong>
          <small>{mostGames?.gameName||"jogador não identificado"}</small>
        </article>
      </section>

      <section className="panel leaderboard-table-panel">
        <div className="leaderboard-table-head">
          <span>#</span>
          <span>Jogador</span>
          <span>LP</span>
          <span>Jogos</span>
          <span>V / D</span>
          <span>Win rate</span>
          <span></span>
        </div>

        <div className="leaderboard-table">
          {data.players.map((player,index)=>{
            const icon=staticData&&player.profileIconId
              ?profileIconUrl(staticData.version,player.profileIconId)
              :"";
            const canOpen=Boolean(player.gameName&&player.tagLine);
            const displayName=player.gameName||"Ranqueado #"+(index+1);
            return <article className={canOpen?"resolved":"unresolved"} key={player.summonerId||index}>
              <b>{index+1}</b>
              <div className="leaderboard-player">
                <span>{icon?<img src={icon} alt=""/>:<b>{index+1}</b>}</span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{player.tagLine
                    ?"#"+player.tagLine
                    :"Riot ID pendente"}{player.hotStreak?" · hot streak":player.veteran?" · veterano":player.freshBlood?" · novo no tier":""}</small>
                </div>
              </div>
              <strong>{player.leaguePoints}</strong>
              <span>{player.games}</span>
              <span>{player.wins} / {player.losses}</span>
              <span>{player.winRate}%</span>
              <button disabled={!canOpen} onClick={()=>canOpen&&onOpenPlayer(player,data.platform)}>
                {canOpen?"Abrir perfil":"ID pendente"}
              </button>
            </article>;
          })}
        </div>
      </section>

      <p className="leaderboard-disclaimer">O ranking e LP vêm dos endpoints ranqueados da Riot. A resolução de Riot ID é best-effort e pode falhar para algumas entradas.</p>
    </>}
  </main>;
}
