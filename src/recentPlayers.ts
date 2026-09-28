export type RecentPlayer={
  gameName:string;
  tagLine:string;
  platform:string;
  level:number;
  rankLabel:string;
  leaguePoints:number|null;
  averagePlacement:number|null;
  top4Rate:number;
  matches:number;
  lastSeen:number;
};

const KEY="chibi.gg:recent-players:v1";

export function getRecentPlayers():RecentPlayer[]{
  try{
    const raw=localStorage.getItem(KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed.slice(0,8):[];
  }catch{
    return [];
  }
}

export function saveRecentPlayer(player:RecentPlayer){
  const id=(player.platform+":"+player.gameName+"#"+player.tagLine).toLowerCase();
  const next=[
    player,
    ...getRecentPlayers().filter(item=>
      (item.platform+":"+item.gameName+"#"+item.tagLine).toLowerCase()!==id
    ),
  ].slice(0,8);
  localStorage.setItem(KEY,JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("chibi:recent-players"));
  return next;
}

export function removeRecentPlayer(player:RecentPlayer){
  const id=(player.platform+":"+player.gameName+"#"+player.tagLine).toLowerCase();
  const next=getRecentPlayers().filter(item=>
    (item.platform+":"+item.gameName+"#"+item.tagLine).toLowerCase()!==id
  );
  localStorage.setItem(KEY,JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("chibi:recent-players"));
  return next;
}
