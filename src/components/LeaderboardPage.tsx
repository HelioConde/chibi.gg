import { useEffect, useMemo, useState } from "react";
import {
  fetchTftLeaderboard,
  TftLeaderboard,
  TftLeaderboardPlayer,
} from "../api/tft";
import { profileIconUrl, TftStaticData } from "../tftStatic";
import { useI18n } from "../i18n";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";
import ArtworkRibbon from "./ArtworkRibbon";
import V2PanelAccent from "./V2PanelAccent";

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
  const { t } = useI18n();
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
        setError(err instanceof Error?err.message:t("leaderboard.errorLoad"));
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
    <section className="leaderboard-hero page-hero-with-reference leaderboard-hero-art">
      <AdaptiveArtwork className="v2-hero-emblem v2-hero-emblem-ranking" src={SITE_IMAGES.v2.badges.rankAlt} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
      <AdaptiveArtwork className="page-reference-art leaderboard-reference-art page-reference-v2-piece" src={SITE_IMAGES.v2.frames.squareSecondary} alt="" aria-hidden="true" loading="eager" decoding="async"/>
      <div>
        <span className="eyebrow">TFT LEADERBOARD</span>
        <h1>{t("leaderboard.title1")}<br/><em>{t("leaderboard.title2")}</em></h1>
        <p>{t("leaderboard.desc")}</p>
      </div>

      <div className="leaderboard-context">
        <V2PanelAccent kind="ranking"/>
        <span>{t("leaderboard.region")}</span>
        <strong>{platform.toUpperCase()}</strong>
        <small>{tier}</small>
      </div>
    </section>

    <ArtworkRibbon sources={[SITE_IMAGES.v2.badges.rankAlt,SITE_IMAGES.v2.icons[2],SITE_IMAGES.v2.frames.squareSecondary]} className="leaderboard-art-ribbon"/>

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

    {loading&&<section className="panel meta-page-state" role="status" aria-live="polite">{t("leaderboard.loading")}</section>}
    {!loading&&error&&<section className="panel meta-page-state error" role="alert" aria-live="assertive">{t("leaderboard.loadFailed")}</section>}

    {!loading&&!error&&data&&<>
      <div className="leaderboard-sample-note">
        <strong>Ranking oficial · recorte exibido</strong>
        <span>{data.players.length} jogadores carregados · {data.platform.toUpperCase()} · {tier}</span>
      </div>
      <section className="leaderboard-highlights">
        <article className="panel">
          <span>#1 LP</span>
          <strong>{data.players[0]?.leaguePoints??"—"}</strong>
          <small>{data.players[0]?.gameName||t("leaderboard.rank1")}</small>
        </article>
        <article className="panel">
          <span>{t("leaderboard.bestWinRate")}</span>
          <strong>{bestWinRate?bestWinRate.winRate+"%":"—"}</strong>
          <small>{bestWinRate?.gameName||t("leaderboard.unidentified")} · entre {data.players.length} exibidos</small>
        </article>
        <article className="panel">
          <span>{t("leaderboard.mostGames")}</span>
          <strong>{mostGames?.games??"—"}</strong>
          <small>{mostGames?.gameName||t("leaderboard.unidentified")} · entre {data.players.length} exibidos</small>
        </article>
      </section>

      <section className="panel leaderboard-table-panel">
        <div className="leaderboard-table-head">
          <span>#</span>
          <span>{t("leaderboard.player")}</span>
          <span>LP</span>
          <span>{t("leaderboard.games")}</span>
          <span>{t("leaderboard.winLoss")}</span>
          <span>{t("leaderboard.winRate")}</span>
          <span></span>
        </div>

        <div className="leaderboard-table">
          {data.players.map((player,index)=>{
            const icon=staticData&&player.profileIconId
              ?profileIconUrl(staticData.version,player.profileIconId)
              :"";
            const canOpen=Boolean(player.gameName&&player.tagLine);
            const displayName=player.gameName||(t("leaderboard.rank1").replace("#1","#"+(index+1)));
            return <article className={canOpen?"resolved":"unresolved"} key={player.summonerId||index}>
              <b>{index+1}</b>
              <div className="leaderboard-player">
                <span>{icon?<img src={icon} alt=""/>:<b>{index+1}</b>}</span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{player.tagLine
                    ?"#"+player.tagLine
                    :t("leaderboard.pendingRiotId")}{player.hotStreak?" · hot streak":player.veteran?" · "+t("leaderboard.veteran"):player.freshBlood?" · "+t("leaderboard.newTier"):""}</small>
                </div>
              </div>
              <strong>{player.leaguePoints}</strong>
              <span>{player.games}</span>
              <span>{player.wins} / {player.losses}</span>
              <span>{player.winRate}%</span>
              <button disabled={!canOpen} onClick={()=>canOpen&&onOpenPlayer(player,data.platform)}>
                {canOpen?t("leaderboard.openProfile"):t("leaderboard.pendingId")}
              </button>
            </article>;
          })}
        </div>
      </section>

      <p className="leaderboard-disclaimer">{t("leaderboard.disclaimer")}</p>
    </>}
  </main>;
}
