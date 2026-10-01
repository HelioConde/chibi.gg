import { SITE_IMAGES } from "../siteAssets";

type Props={
  page:string;
  profileTab:string;
  hasProfile:boolean;
};

export default function SiteArtworkBackdrop({page,profileTab,hasProfile}:Props){
  let key=page;
  if(page==="main"){
    key=hasProfile?profileTab:"home";
  }else if(page==="about"||page==="privacy"||page==="terms"){
    key="legal";
  }

  return <div className={"site-art-backdrop site-background-route-"+key} aria-hidden="true">
    <img className="site-background-art" src={SITE_IMAGES.art} alt="" loading="eager" decoding="async"/>
    <span className="site-background-veil"/>
  </div>;
}
