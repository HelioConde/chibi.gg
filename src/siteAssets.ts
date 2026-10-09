export function siteImage(name:string){
  // Every PNG in public/img has a generated WebP counterpart from prebuild/predev.
  // Keep original PNGs for legal pages, social crawlers and safe backward compatibility.
  const optimizedName=name.replace(/\\.png$/i,".webp");
  return import.meta.env.BASE_URL+"img/"+optimizedName;
}

function outputV2Element(group:string,index:number){
  return siteImage(`output-v2/${group}/element_${String(index).padStart(3,"0")}.png`);
}

function outputV2Group(group:string,length:number){
  return Array.from({length},(_,index)=>outputV2Element(group,index+1));
}

const CHIBI_UI_ARTS=Array.from({length:22},(_,index)=>
  siteImage(`chibi-ui-${String(index+1).padStart(2,"0")}.png`)
);

const V2_GROUPS={
  ui03:outputV2Group("chibi-ui-03",4),
  ui04:outputV2Group("chibi-ui-04",4),
  ui05:outputV2Group("chibi-ui-05",2),
  ui06:outputV2Group("chibi-ui-06",9),
  ui07:outputV2Group("chibi-ui-07",16),
  ui08:outputV2Group("chibi-ui-08",16),
  ui09:outputV2Group("chibi-ui-09",25),
  ui10:outputV2Group("chibi-ui-10",10),
  ui13:outputV2Group("chibi-ui-13",10),
  ui14:outputV2Group("chibi-ui-14",32),
  ui15:outputV2Group("chibi-ui-15",16),
  ui16:outputV2Group("chibi-ui-16",16),
  ui17:outputV2Group("chibi-ui-17",12),
  ui18:outputV2Group("chibi-ui-18",17),
  ui19:outputV2Group("chibi-ui-19",8),
  ui20:outputV2Group("chibi-ui-20",15),
  hud:outputV2Group("hud",4),
  icons:outputV2Group("icons",11),
};

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
    hud:V2_GROUPS.hud,
    icon:outputV2Element("icon",1),
    icons:V2_GROUPS.icons,
    packs:{
      portraitFrames:V2_GROUPS.ui03,
      wideFrames:V2_GROUPS.ui04,
      utilityPanels:V2_GROUPS.ui05,
      economyMascots:V2_GROUPS.ui06,
      heartBadges:V2_GROUPS.ui07,
      rankBadges:V2_GROUPS.ui08,
      microDecor:V2_GROUPS.ui09,
      mobilePieces:V2_GROUPS.ui10,
      portraitAlt:V2_GROUPS.ui13,
      rails:V2_GROUPS.ui14,
      wideAlt:V2_GROUPS.ui15,
      scoutMascots:V2_GROUPS.ui16,
      swordBadges:V2_GROUPS.ui17,
      boardMascots:V2_GROUPS.ui18,
      squareFrames:V2_GROUPS.ui19,
      landscapeFrames:V2_GROUPS.ui20,
    },
    frames:{
      portrait:V2_GROUPS.ui03[0],
      portraitSecondary:V2_GROUPS.ui03[3],
      wide:V2_GROUPS.ui04[0],
      wideSecondary:V2_GROUPS.ui04[2],
      portraitAlt:V2_GROUPS.ui13[0],
      wideAlt:V2_GROUPS.ui15[0],
      wideAltSecondary:V2_GROUPS.ui15[2],
      square:V2_GROUPS.ui19[0],
      squareSecondary:V2_GROUPS.ui19[2],
      landscape:V2_GROUPS.ui20[1],
      landscapeSecondary:V2_GROUPS.ui20[2],
    },
    mascots:{
      economy:V2_GROUPS.ui06[0],
      economyAlt:V2_GROUPS.ui06[4],
      scout:V2_GROUPS.ui16[0],
      scoutAlt:V2_GROUPS.ui16[8],
      board:V2_GROUPS.ui18[11],
      boardAlt:V2_GROUPS.ui18[14],
    },
    badges:{
      heart:V2_GROUPS.ui07[0],
      heartAlt:V2_GROUPS.ui07[6],
      rank:V2_GROUPS.ui08[4],
      rankAlt:V2_GROUPS.ui08[10],
      sword:V2_GROUPS.ui17[0],
      swordAlt:V2_GROUPS.ui17[4],
    },
    decor:{
      corner:V2_GROUPS.ui09[2],
      cornerAlt:V2_GROUPS.ui09[8],
      rail:V2_GROUPS.ui14[11],
      railAlt:V2_GROUPS.ui14[15],
      accent:V2_GROUPS.ui14[23],
    },
    showcase:{
      history:V2_GROUPS.ui04[2],
      comps:V2_GROUPS.ui20[2],
      augments:V2_GROUPS.ui14[11],
      positioning:V2_GROUPS.ui18[14],
      coach:V2_GROUPS.ui16[8],
      mobile:V2_GROUPS.ui03[3],
    },
  },
};
