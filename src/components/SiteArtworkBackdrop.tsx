import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  page:string;
  profileTab:string;
  hasProfile:boolean;
};

const map:Record<string,string[]>={
  home:[SITE_IMAGES.v2.frames.portraitSecondary,SITE_IMAGES.v2.mascots.boardAlt,SITE_IMAGES.v2.decor.cornerAlt],
  profile:[SITE_IMAGES.v2.frames.wideSecondary,SITE_IMAGES.v2.mascots.scoutAlt,SITE_IMAGES.v2.badges.swordAlt],
  matches:[SITE_IMAGES.v2.frames.portrait,SITE_IMAGES.v2.badges.swordAlt,SITE_IMAGES.v2.decor.rail],
  overview:[SITE_IMAGES.v2.mascots.scoutAlt,SITE_IMAGES.v2.badges.rankAlt,SITE_IMAGES.v2.frames.squareSecondary],
  coach:[SITE_IMAGES.v2.mascots.boardAlt,SITE_IMAGES.v2.badges.heartAlt,SITE_IMAGES.v2.frames.landscapeSecondary],
  share:[SITE_IMAGES.v2.icons[10],SITE_IMAGES.v2.frames.portraitAlt,SITE_IMAGES.v2.decor.cornerAlt],
  meta:[SITE_IMAGES.v2.icons[8],SITE_IMAGES.v2.frames.landscapeSecondary,SITE_IMAGES.v2.mascots.scoutAlt],
  comps:[SITE_IMAGES.v2.icons[0],SITE_IMAGES.v2.frames.squareSecondary,SITE_IMAGES.v2.mascots.boardAlt],
  stats:[SITE_IMAGES.v2.icons[6],SITE_IMAGES.v2.frames.landscapeSecondary,SITE_IMAGES.v2.badges.rankAlt],
  builder:[SITE_IMAGES.v2.icons[7],SITE_IMAGES.v2.mascots.boardAlt,SITE_IMAGES.v2.decor.railAlt],
  leaderboard:[SITE_IMAGES.v2.badges.rankAlt,SITE_IMAGES.v2.icons[2],SITE_IMAGES.v2.frames.squareSecondary],
  overlay:[SITE_IMAGES.v2.mascots.scoutAlt,SITE_IMAGES.v2.frames.landscapeSecondary,SITE_IMAGES.v2.decor.accent],
  legal:[SITE_IMAGES.v2.frames.portraitAlt,SITE_IMAGES.v2.decor.cornerAlt,SITE_IMAGES.v2.icons[3]],
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
      <span className={"site-art-frame site-art-frame-"+position+" site-art-v2"} key={key+":"+src}>
        <AdaptiveArtwork src={src} alt="" loading={position===0?"eager":"lazy"} decoding="async"/>
      </span>
    ))}
  </div>;
}
