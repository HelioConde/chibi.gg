import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  images?:number[];
  sources?:string[];
  className?:string;
};

const organizedFallbacks=[
  SITE_IMAGES.v2.frames.wideSecondary,
  SITE_IMAGES.v2.frames.landscapeSecondary,
  SITE_IMAGES.v2.mascots.scoutAlt,
  SITE_IMAGES.v2.mascots.boardAlt,
  SITE_IMAGES.v2.badges.rankAlt,
  SITE_IMAGES.v2.badges.swordAlt,
  SITE_IMAGES.v2.badges.heartAlt,
  SITE_IMAGES.v2.decor.railAlt,
  SITE_IMAGES.v2.decor.cornerAlt,
  SITE_IMAGES.v2.frames.squareSecondary,
  SITE_IMAGES.v2.frames.portraitSecondary,
];

export default function ArtworkRibbon({images=[],sources=[],className=""}:Props){
  const organized=images.map((index)=>
    organizedFallbacks[Math.abs(index)%organizedFallbacks.length]
    || SITE_IMAGES.ui.all[index]
  );
  const unique=[...new Set([...sources,...organized])].filter(Boolean).slice(0,3);

  if(!unique.length)return null;

  return <section className={"artwork-ribbon artwork-ribbon-v2 "+className} aria-hidden="true">
    {unique.map((src,position)=>(
      <figure className={"artwork-ribbon-card artwork-ribbon-card-"+position} key={src}>
        <AdaptiveArtwork
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span/>
      </figure>
    ))}
  </section>;
}
