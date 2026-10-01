import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  page:string;
  profileTab:string;
  hasProfile:boolean;
};

const map:Record<string,string[]>={
  home:[SITE_IMAGES.v2.frames.portraitAlt,SITE_IMAGES.v2.mascots.board,SITE_IMAGES.v2.decor.corner],
  profile:[SITE_IMAGES.v2.frames.wide,SITE_IMAGES.v2.mascots.scout,SITE_IMAGES.v2.badges.sword],
  matches:[SITE_IMAGES.v2.frames.portrait,SITE_IMAGES.v2.icons[5],SITE_IMAGES.v2.badges.sword],
  overview:[SITE_IMAGES.v2.mascots.scout,SITE_IMAGES.v2.icons[6],SITE_IMAGES.v2.frames.square],
  coach:[SITE_IMAGES.v2.mascots.board,SITE_IMAGES.v2.badges.heart,SITE_IMAGES.v2.frames.landscape],
  share:[SITE_IMAGES.v2.icons[10],SITE_IMAGES.v2.frames.portraitAlt,SITE_IMAGES.v2.decor.corner],
  meta:[SITE_IMAGES.v2.icons[8],SITE_IMAGES.v2.frames.landscape,SITE_IMAGES.v2.mascots.scout],
  comps:[SITE_IMAGES.v2.icons[0],SITE_IMAGES.v2.frames.square,SITE_IMAGES.v2.mascots.board],
  stats:[SITE_IMAGES.v2.icons[6],SITE_IMAGES.v2.frames.landscape,SITE_IMAGES.v2.badges.rank],
  builder:[SITE_IMAGES.v2.icons[7],SITE_IMAGES.v2.mascots.board,SITE_IMAGES.v2.frames.landscape],
  leaderboard:[SITE_IMAGES.v2.badges.rank,SITE_IMAGES.v2.icons[2],SITE_IMAGES.v2.frames.square],
  overlay:[SITE_IMAGES.v2.mascots.scout,SITE_IMAGES.v2.frames.landscape,SITE_IMAGES.v2.icons[8]],
  legal:[SITE_IMAGES.v2.frames.portraitAlt,SITE_IMAGES.v2.decor.corner,SITE_IMAGES.v2.icons[3]],
};

export default function SiteArtworkBackdrop({page,profileTab,hasProfile}:Props){
  let key=page;
  if(page==="main"){
    key=hasProfile?profileTab:"home";
  }else if(page==="about"||page==="privacy"||page==="terms"){
    key="legal";
  }

  const sources=map[key]||map.home;
  return <div className={"site-art-backdrop site-art-"+key} aria-hidden="true">
    {sources.map((src,position)=>(
      <span className={"site-art-frame site-art-frame-"+position} key={key+":"+src}>
        <AdaptiveArtwork src={src} alt="" loading={position===0?"eager":"lazy"} decoding="async"/>
      </span>
    ))}
  </div>;
}
