export function siteImage(name:string){
  return import.meta.env.BASE_URL+"img/"+name;
}

function outputV2Element(group:string,index:number){
  return siteImage(`output-v2/${group}/element_${String(index).padStart(3,"0")}.png`);
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
  v2:{
    hud:Array.from({length:4},(_,index)=>outputV2Element("hud",index+1)),
    icon:outputV2Element("icon",1),
    icons:Array.from({length:11},(_,index)=>outputV2Element("icons",index+1)),
    frames:{
      portrait:outputV2Element("chibi-ui-03",1),
      wide:outputV2Element("chibi-ui-04",1),
      portraitAlt:outputV2Element("chibi-ui-13",1),
      wideAlt:outputV2Element("chibi-ui-15",1),
      square:outputV2Element("chibi-ui-19",1),
      landscape:outputV2Element("chibi-ui-20",2),
    },
    mascots:{
      economy:outputV2Element("chibi-ui-06",1),
      scout:outputV2Element("chibi-ui-16",1),
      board:outputV2Element("chibi-ui-18",12),
    },
    badges:{
      heart:outputV2Element("chibi-ui-07",1),
      rank:outputV2Element("chibi-ui-08",5),
      sword:outputV2Element("chibi-ui-17",1),
    },
    decor:{
      corner:outputV2Element("chibi-ui-09",3),
      rail:outputV2Element("chibi-ui-14",12),
    },
  },
};
