import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

export type V2PanelAccentKind=
  |"meta"
  |"comps"
  |"stats"
  |"builder"
  |"ranking"
  |"companion"
  |"positive"
  |"danger";

const sourceByKind:Record<V2PanelAccentKind,string>={
  meta:SITE_IMAGES.v2.decor.cornerAlt,
  comps:SITE_IMAGES.v2.mascots.boardAlt,
  stats:SITE_IMAGES.v2.badges.rankAlt,
  builder:SITE_IMAGES.v2.mascots.economyAlt,
  ranking:SITE_IMAGES.v2.badges.rankAlt,
  companion:SITE_IMAGES.v2.mascots.scoutAlt,
  positive:SITE_IMAGES.v2.badges.heartAlt,
  danger:SITE_IMAGES.v2.badges.swordAlt,
};

export default function V2PanelAccent({
  kind,
  className="",
}:{
  kind:V2PanelAccentKind;
  className?:string;
}){
  return <span className={"v2-panel-accent v2-panel-accent-"+kind+" "+className} aria-hidden="true">
    <AdaptiveArtwork src={sourceByKind[kind]} alt="" loading="lazy" decoding="async"/>
  </span>;
}
