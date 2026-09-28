export function siteImage(name:"art.png"|"hud.png"|"icon.png"|"icons.png"){
  return import.meta.env.BASE_URL+"img/"+name;
}

export const SITE_IMAGES={
  art:siteImage("art.png"),
  hud:siteImage("hud.png"),
  icon:siteImage("icon.png"),
  icons:siteImage("icons.png"),
};
