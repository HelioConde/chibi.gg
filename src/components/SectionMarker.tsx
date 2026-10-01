type Props={
  index:string;
  kicker:string;
  title:string;
  description?:string;
  compact?:boolean;
};

export default function SectionMarker({index,kicker,title,description,compact=false}:Props){
  return <header className={"section-marker"+(compact?" compact":"")}>
    <span className="section-marker-index">{index}</span>
    <div>
      <small>{kicker}</small>
      <h2>{title}</h2>
      {description&&<p>{description}</p>}
    </div>
    <i aria-hidden="true"/>
  </header>;
}
