import { SITE_IMAGES } from "../siteAssets";

export type ChibiNavIconKind=
  |"meta"|"comps"|"statistics"|"builder"|"ranking"|"companion"
  |"profile"|"history"|"share"|"download";

const iconIndex:Record<ChibiNavIconKind,number>={
  comps:0,
  profile:1,
  ranking:2,
  companion:8,
  history:5,
  statistics:6,
  builder:7,
  meta:8,
  download:9,
  share:10,
};

export default function ChibiNavIcon({kind,className=""}:{kind:ChibiNavIconKind;className?:string}){
  return <img
    className={"chibi-nav-icon "+className}
    src={SITE_IMAGES.v2.icons[iconIndex[kind]]}
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
  />;
}
