import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  images?:number[];
  sources?:string[];
  className?:string;
};

export default function ArtworkRibbon({images=[],sources=[],className=""}:Props){
  const legacy=images
    .filter(index=>index>=0&&index<SITE_IMAGES.ui.all.length)
    .map(index=>SITE_IMAGES.ui.all[index]);
  const unique=[...new Set([...sources,...legacy])].filter(Boolean).slice(0,3);

  if(!unique.length)return null;

  return <section className={"artwork-ribbon "+className} aria-hidden="true">
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
