export type ChibiLesson={
  id:string;
  playerKey:string;
  matchId:string;
  matchIds?:string[];
  text:string;
  createdAt:number;
  lastReviewedAt:number;
  reviewCount:number;
  archived:boolean;
};

const KEY="chibi.gg:lessons:v1";
const REVIEW_INTERVALS=[0,86400000,3*86400000,7*86400000,14*86400000,30*86400000];

function readAll():ChibiLesson[]{
  try{
    const raw=localStorage.getItem(KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function writeAll(rows:ChibiLesson[]){
  localStorage.setItem(KEY,JSON.stringify(rows.slice(-100)));
  window.dispatchEvent(new CustomEvent("chibi:lessons-change"));
}

export function getLessons(playerKey:string){
  return readAll()
    .filter(lesson=>lesson.playerKey===playerKey&&!lesson.archived)
    .sort((a,b)=>b.createdAt-a.createdAt);
}

export function saveLesson(playerKey:string,matchId:string,text:string,matchIds?:string[]){
  const clean=text.trim().slice(0,280);
  if(!clean)return null;

  const rows=readAll();
  const existing=rows.find(lesson=>
    lesson.playerKey===playerKey&&
    lesson.matchId===matchId&&
    lesson.text.toLowerCase()===clean.toLowerCase()&&
    !lesson.archived
  );
  if(existing)return existing;

  const lesson:ChibiLesson={
    id:playerKey+":"+matchId+":"+Date.now(),
    playerKey,
    matchId,
    matchIds:matchIds?.filter(Boolean).slice(0,10),
    text:clean,
    createdAt:Date.now(),
    lastReviewedAt:0,
    reviewCount:0,
    archived:false,
  };

  writeAll([...rows,lesson]);
  return lesson;
}

export function markLessonReviewed(id:string){
  const rows=readAll();
  const index=rows.findIndex(lesson=>lesson.id===id);
  if(index<0)return null;

  rows[index]={
    ...rows[index],
    lastReviewedAt:Date.now(),
    reviewCount:rows[index].reviewCount+1,
  };
  writeAll(rows);
  return rows[index];
}

export function archiveLesson(id:string){
  const rows=readAll();
  const index=rows.findIndex(lesson=>lesson.id===id);
  if(index<0)return;
  rows[index]={...rows[index],archived:true};
  writeAll(rows);
}

export function lessonDueAt(lesson:ChibiLesson){
  if(!lesson.lastReviewedAt)return lesson.createdAt;
  const interval=REVIEW_INTERVALS[Math.min(lesson.reviewCount,REVIEW_INTERVALS.length-1)]||REVIEW_INTERVALS[REVIEW_INTERVALS.length-1];
  return lesson.lastReviewedAt+interval;
}

export function getDueLessons(playerKey:string,now=Date.now()){
  return getLessons(playerKey)
    .filter(lesson=>lessonDueAt(lesson)<=now)
    .sort((a,b)=>lessonDueAt(a)-lessonDueAt(b));
}
