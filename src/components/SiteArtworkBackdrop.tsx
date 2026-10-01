import { SITE_IMAGES } from "../siteAssets";

type Props={
  page:string;
  profileTab:string;
  hasProfile:boolean;
};

const map:Record<string,number[]>={
  home:[0,10,11],
  profile:[1,12,16],
  matches:[2,11,17],
  overview:[6,13,18],
  coach:[8,16,21],
  share:[9,14,20],
  meta:[7,12,18],
  comps:[3,19,20],
  stats:[4,10,18],
  builder:[5,13,16],
  leaderboard:[14,17,21],
  overlay:[9,15,19],
  legal:[10,20,21],
};

export default function SiteArtworkBackdrop({page,profileTab,hasProfile}:Props){
  let key=page;
  if(page==="main"){
    key=hasProfile?profileTab:"home";
  }else if(page==="about"||page==="privacy"||page==="terms"){
    key="legal";
  }

  const ids=map[key]||map.home;
  return <div className={"site-art-backdrop site-art-"+key} aria-hidden="true">
    {ids.map((index,position)=>(
      <span className={"site-art-frame site-art-frame-"+position} key={key+":"+index}>
        <img src={SITE_IMAGES.ui.all[index]} alt="" loading={position===0?"eager":"lazy"} decoding="async"/>
      </span>
    ))}
  </div>;
}
