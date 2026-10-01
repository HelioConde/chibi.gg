export function siteImage(name:string){
  return import.meta.env.BASE_URL+"img/"+name;
}

const CHIBI_UI_ARTS=Array.from({length:22},(_,index)=>
  siteImage(`chibi-ui-${String(index+1).padStart(2,"0")}.png`)
);

export const SITE_IMAGES={
  art:siteImage("art.png"),
  hud:siteImage("hud.png"),
  icon:siteImage("icon.png"),
  icons:siteImage("icons.png"),
  ui:{
    home:CHIBI_UI_ARTS[0],
    profile:CHIBI_UI_ARTS[1],
    history:CHIBI_UI_ARTS[2],
    comps:CHIBI_UI_ARTS[3],
    augments:CHIBI_UI_ARTS[4],
    positioning:CHIBI_UI_ARTS[5],
    economy:CHIBI_UI_ARTS[6],
    comparison:CHIBI_UI_ARTS[7],
    coach:CHIBI_UI_ARTS[8],
    mobile:CHIBI_UI_ARTS[9],
    extras:CHIBI_UI_ARTS.slice(10),
    all:CHIBI_UI_ARTS,
  },
};
