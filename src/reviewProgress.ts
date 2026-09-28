const PREFIX="chibi.gg:reviewed:v1:";

function storageKey(playerKey:string){
  return PREFIX+encodeURIComponent(playerKey.toLowerCase());
}

export function getReviewedMatchIds(playerKey:string){
  try{
    const raw=localStorage.getItem(storageKey(playerKey));
    const parsed=raw?JSON.parse(raw):[];
    return new Set(Array.isArray(parsed)?parsed.map(String):[]);
  }catch{
    return new Set<string>();
  }
}

export function setReviewedMatchIds(playerKey:string,ids:Set<string>){
  localStorage.setItem(storageKey(playerKey),JSON.stringify([...ids].slice(-100)));
  window.dispatchEvent(new CustomEvent("chibi:reviewed",{detail:{playerKey}}));
}

export function markMatchReviewed(playerKey:string,matchId:string,reviewed=true){
  const ids=getReviewedMatchIds(playerKey);
  if(reviewed) ids.add(matchId);
  else ids.delete(matchId);
  setReviewedMatchIds(playerKey,ids);
  return ids;
}

export function isMatchReviewed(playerKey:string,matchId:string){
  return getReviewedMatchIds(playerKey).has(matchId);
}
