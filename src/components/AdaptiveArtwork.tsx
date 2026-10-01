import { ImgHTMLAttributes, SyntheticEvent } from "react";

type Props=ImgHTMLAttributes<HTMLImageElement>;

export default function AdaptiveArtwork({className="",onLoad,...props}:Props){
  function handleLoad(event:SyntheticEvent<HTMLImageElement>){
    const img=event.currentTarget;
    const ratio=img.naturalWidth/Math.max(1,img.naturalHeight);
    img.classList.remove("art-portrait","art-landscape","art-square");
    img.classList.add(
      ratio<.82?"art-portrait":
      ratio>1.18?"art-landscape":
      "art-square"
    );
    onLoad?.(event);
  }

  return <img
    {...props}
    className={"adaptive-artwork "+className}
    onLoad={handleLoad}
  />;
}
