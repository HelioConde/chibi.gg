import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";

export default function SiteHudOverlay(){
  return <div className="site-hud-overlay" aria-hidden="true">
    <AdaptiveArtwork className="site-hud-texture" src={SITE_IMAGES.hud} alt="" loading="eager" decoding="async"/>
    <AdaptiveArtwork className="site-hud-icons" src={SITE_IMAGES.icons} alt="" loading="lazy" decoding="async"/>
    <span className="site-hud-corner site-hud-corner-tl"/>
    <span className="site-hud-corner site-hud-corner-tr"/>
    <span className="site-hud-corner site-hud-corner-bl"/>
    <span className="site-hud-corner site-hud-corner-br"/>
    <span className="site-hud-scanline"/>
  </div>;
}
