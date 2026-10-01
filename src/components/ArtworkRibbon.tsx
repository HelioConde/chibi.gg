import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

type Props={
  images:number[];
  className?:string;
};

export default function ArtworkRibbon({images,className=""}:Props){
  const unique=[...new Set(images)].filter(index=>index>=0&&index<SITE_IMAGES.ui.all.length).slice(0,3);

  if(!unique.length)return null;

  return <section className={"artwork-ribbon "+className} aria-hidden="true">
    {unique.map((index,position)=>(
      <figure className={"artwork-ribbon-card artwork-ribbon-card-"+position} key={index}>
        <AdaptiveArtwork
          src={SITE_IMAGES.ui.all[index]}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span/>
      </figure>
    ))}
  </section>;
}
