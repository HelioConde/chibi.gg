export type RankSnapshot={
  createdAt:number;
  queueType:string;
  tier:string;
  rank:string;
  leaguePoints:number;
  wins:number;
  losses:number;
};

const PREFIX="chibi.gg:rank-history:v1:";

function key(playerKey:string){
  return PREFIX+encodeURIComponent(playerKey.toLowerCase());
}

export function getRankHistory(playerKey:string):RankSnapshot[]{
  try{
    const raw=localStorage.getItem(key(playerKey));
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed.slice(-60):[];
  }catch{
    return [];
  }
}

export function recordRankSnapshot(
  playerKey:string,
  ranked:Array<{
    queueType:string;
    tier:string;
    rank:string;
    leaguePoints:number;
    wins:number;
    losses:number;
  }>,
){
  const row=ranked.find(item=>String(item.queueType).toUpperCase()==="RANKED_TFT")
    || ranked.find(item=>String(item.queueType).toUpperCase().includes("RANKED_TFT"))
    || ranked[0];

  if(!row) return getRankHistory(playerKey);

  const history=getRankHistory(playerKey);
  const latest=history[history.length-1];
  const unchanged=latest
    && latest.tier===row.tier
    && latest.rank===row.rank
    && latest.leaguePoints===row.leaguePoints
    && latest.wins===row.wins
    && latest.losses===row.losses;

  if(unchanged&&Date.now()-latest.createdAt<12*60*60*1000){
    return history;
  }

  const next=[
    ...history,
    {
      createdAt:Date.now(),
      queueType:row.queueType,
      tier:row.tier,
      rank:row.rank,
      leaguePoints:row.leaguePoints,
      wins:row.wins,
      losses:row.losses,
    },
  ].slice(-60);

  localStorage.setItem(key(playerKey),JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("chibi:rank-history",{detail:{playerKey}}));
  return next;
}
