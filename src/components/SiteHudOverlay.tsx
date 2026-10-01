import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

export default function SiteHudOverlay(){
  return <div className="site-hud-overlay" aria-hidden="true">
    <AdaptiveArtwork className="site-hud-v2-rail" src={SITE_IMAGES.v2.hud[0]} alt="" loading="eager" decoding="async"/>
    <AdaptiveArtwork className="site-hud-v2-emblem site-hud-v2-emblem-left" src={SITE_IMAGES.v2.badges.sword} alt="" loading="lazy" decoding="async"/>
    <AdaptiveArtwork className="site-hud-v2-emblem site-hud-v2-emblem-right" src={SITE_IMAGES.v2.mascots.scout} alt="" loading="lazy" decoding="async"/>
    <span className="site-hud-corner site-hud-corner-tl"/>
    <span className="site-hud-corner site-hud-corner-tr"/>
    <span className="site-hud-corner site-hud-corner-bl"/>
    <span className="site-hud-corner site-hud-corner-br"/>
    <span className="site-hud-scanline"/>
  </div>;
}
