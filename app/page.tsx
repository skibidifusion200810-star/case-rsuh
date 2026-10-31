'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import './home.css';

type CasePreview={id:string;name:string;slug:string;price:number;imageUrl?:string|null;items?:{name:string;imageUrl?:string|null}[]};
type Viewer={username:string;coins:number}|null;
const euros=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value/100);
const sections=[
 {href:'/cases',n:'01',label:'KISTEN',description:'Neun Kisten. Eigene Drops. Deine nächste Öffnung.',detail:'ARSENAL',icon:'◈'},
 {href:'/battles',n:'02',label:'CASE BATTLES',description:'Eigene Duelle erstellen und gegen Spieler oder Bots antreten.',detail:'PVP / BOTS',icon:'⚔'},
 {href:'/inventory',n:'03',label:'INVENTAR',description:'Deine Skins ansehen, behalten oder virtuell verkaufen.',detail:'COLLECTION',icon:'▤'},
 {href:'/leaderboard',n:'04',label:'BESTENLISTE',description:'Wer hat die meisten Öffnungen und das wertvollste Inventar?',detail:'RANKINGS',icon:'⌁'}
] as const;
function CaseVisual({src,alt,priority=false}:{src?:string|null;alt:string;priority?:boolean}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return src&&!broken
  ? <img src={src} alt={alt} loading={priority?'eager':'lazy'} referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>
  : <span className="landing-art-fallback" aria-label={alt}>◈</span>;
}
export default function Home(){
 const [cases,setCases]=useState<CasePreview[]>([]);
 const [me,setMe]=useState<Viewer>(null);
 const [loading,setLoading]=useState(true);
 const [unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   const [c,u]=await Promise.allSettled([
    fetch('/api/game?action=cases',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Cases unavailable');return r.json()}),
    fetch('/api/game?action=me',{cache:'no-store'}).then(r=>r.ok?r.json():{user:null})
   ]);
   if(!active)return;
   if(c.status==='fulfilled'&&Array.isArray(c.value.cases)){setCases(c.value.cases);setUnavailable(false)}
   else setUnavailable(true);
   if(u.status==='fulfilled')setMe(u.value.user??null);
   setLoading(false);
  };
  void load();
  return()=>{active=false};
 },[]);
 const highlighted=['first-drop','butterfly-vault','karambit-eclipse']
  .map(slug=>cases.find(c=>c.slug===slug)).filter((c):c is CasePreview=>!!c);
 const feature=cases.find(c=>c.slug==='butterfly-vault')??cases.find(c=>c.price>0)??null;
 const extra=cases.find(c=>c.slug==='karambit-eclipse')??null;
 return <div className="landing">
  <div className="landing-glow" aria-hidden="true"/>
  <header className="landing-header">
   <Link href="/" className="landing-brand" aria-label="CASE RUSH Startseite">CASE<span>RUSH</span><i>.</i></Link>
   <nav aria-label="Hauptnavigation" className="landing-navigation">
    <Link href="/cases">KISTEN</Link>
    <Link href="/battles">CASE BATTLES</Link>
    <Link href="/inventory">INVENTAR</Link>
    <Link href="/leaderboard">BESTENLISTE</Link>
    <Link href="/upgrades">UPGRADES</Link>
   </nav>
   <div className="landing-account">
    {me?<><span className="landing-balance">{euros(me.coins)}</span><Link href="/inventory" className="landing-user">{me.username}</Link></>:
      <Link href="/cases?auth=login" className="landing-signin">ANMELDEN</Link>}
    <Link className="landing-header-cta" href="/cases">ZUM SPIEL <span>↗</span></Link>
   </div>
  </header>
  <main className="landing-main">
   <section className="landing-hero" aria-labelledby="landing-title">
    <div className="landing-hero-grid" aria-hidden="true"/>
    <div className="landing-hero-inner">
     <div className="landing-hero-copy">
      <div className="landing-eyebrow"><span className="landing-signal"/> THE NEXT DROP IS YOURS <span className="landing-hero-id">/ 001</span></div>
      <h1 id="landing-title">OPEN.<br/><span>COLLECT.</span><br/><em>COMPETE.</em></h1>
      <p>Dein nächster Drop wartet. Öffne virtuelle CS2-inspirierte Kisten, sammle Skins und tritt in Case Battles gegen andere Spieler oder Bots an.</p>
      <div className="landing-actions">
       <Link href="/cases" className="landing-button landing-button-primary">KISTEN ENTDECKEN <span aria-hidden="true">↗</span></Link>
       <Link href="/battles" className="landing-button landing-button-outline">CASE BATTLES <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="landing-hero-meta">
       <span><strong>{loading?'—':cases.length||'—'}</strong> KISTEN IM SPIEL</span>
       <span className="landing-meta-divider"/>
       <span><strong>0,00 €</strong> STARTER-KISTE</span>
       <span className="landing-meta-divider"/>
       <span><strong>10×</strong> MULTI-OPEN</span>
      </div>
     </div>
     <div className="landing-hero-art">
      <div className="landing-art-crosshair" aria-hidden="true"/>
      <div className="landing-art-ring ring-one" aria-hidden="true"/>
      <div className="landing-art-ring ring-two" aria-hidden="true"/>
      <div className="landing-art-orbit orbit-one" aria-hidden="true"/>
      <div className="landing-art-orbit orbit-two" aria-hidden="true"/>
      <div className="landing-art-label label-top"><span>FEATURED DROP</span><strong>{feature?.name??'CASE RUSH'}</strong></div>
      <div className="landing-main-case">
       <CaseVisual src={feature?.imageUrl} alt={feature?.name??'CASE RUSH Kiste'} priority/>
      </div>
      {extra&&<div className="landing-side-case"><CaseVisual src={extra.imageUrl} alt={extra.name}/></div>}
      <div className="landing-art-price">
       <span>VIRTUELLER KISTENPREIS</span>
       <strong>{feature?euros(feature.price):loading?'LÄDT…':'—'}</strong>
       <Link href="/cases">JETZT ANSEHEN <span>↗</span></Link>
      </div>
      <div className="landing-art-bottom">CASE RUSH <span>///</span> UNBOX EXPERIENCE</div>
     </div>
    </div>
    <div className="landing-scroll-hint" aria-hidden="true"><span/> SCROLL TO EXPLORE</div>
   </section>
   <div className="landing-marquee" aria-hidden="true">
    <div className="landing-marquee-track">{Array.from({length:2},(_,i)=><div key={i} className="landing-marquee-group">
     <span>CASE OPENING</span><b>✦</b><span>RARE DROPS</span><b>✦</b><span>CASE BATTLES</span><b>✦</b><span>BUILD YOUR INVENTORY</span><b>✦</b>
    </div>)}</div>
   </div>
   <section className="landing-featured" id="cases">
    <div className="landing-section-top">
     <div><div className="landing-kicker">01 / THE COLLECTION</div><h2>KISTEN, DIE <em>AUFFALLEN.</em></h2><p>Von der kostenlosen Öffnung bis zum seltenen Highlight. Jede Kiste hat ihre eigenen Drops und Wahrscheinlichkeiten.</p></div>
     <Link href="/cases" className="landing-text-link">ALLE KISTEN ANSEHEN <span>↗</span></Link>
    </div>
    <div className="landing-featured-grid">
     {highlighted.length?highlighted.map((c,i)=><Link href="/cases" className={'landing-case-card landing-case-card-'+i} key={c.id}>
      <div className="landing-card-upper"><span>0{i+1} / SELECTED CASE</span><span>↗</span></div>
      <div className="landing-case-illustration"><div className="landing-case-halo"/><CaseVisual src={c.imageUrl} alt={c.name}/></div>
      <div className="landing-card-footer"><div><span>{c.price===0?'FREE OPENING':'VIRTUAL CASE'}</span><h3>{c.name}</h3></div><strong>{c.price===0?'GRATIS':euros(c.price)}</strong></div>
     </Link>):<div className="landing-load-cases">
       <span className="landing-faint-symbol">◈</span>
       <h3>{loading?'KISTEN WERDEN GELADEN':unavailable?'KISTEN DERZEIT NICHT VERFÜGBAR':'NOCH KEINE KISTEN'}</h3>
       <p>{unavailable?'Die Verbindung zur Datenbank konnte nicht hergestellt werden.':'Die aktuellen Kisten und Preise werden aus dem Spiel geladen.'}</p>
       <Link href="/cases" className="landing-text-link">ZUM ARSENAL ↗</Link>
      </div>}
    </div>
   </section>
   <section className="landing-hub">
    <div className="landing-section-top">
     <div><div className="landing-kicker">02 / YOUR PLAYGROUND</div><h2>DEIN SPIEL. <em>DEINE ROUTE.</em></h2><p>Alles an einem Ort – mit eigenen Bereichen für jeden Teil des Spiels.</p></div>
    </div>
    <div className="landing-hub-grid">
     {sections.map(s=><Link href={s.href} className="landing-hub-tile" key={s.href}>
      <div className="landing-tile-top"><span>{s.n} / {s.detail}</span><span className="landing-tile-arrow">↗</span></div>
      <div className="landing-tile-symbol" aria-hidden="true">{s.icon}</div>
      <div><h3>{s.label}</h3><p>{s.description}</p></div>
     </Link>)}
    </div>
   </section>
   <section className="landing-endcap">
    <div className="landing-endcap-glow" aria-hidden="true"/>
    <div className="landing-kicker">03 / READY WHEN YOU ARE</div>
    <h2>DEIN NÄCHSTER<br/><em>DROP WARTET.</em></h2>
    <p>Öffne die kostenlose Kiste oder starte direkt in die Arena.</p>
    <div className="landing-actions landing-actions-center">
     <Link href="/cases" className="landing-button landing-button-primary">JETZT STARTEN <span>↗</span></Link>
     <Link href="/battles" className="landing-button landing-button-outline">BATTLES ENTDECKEN <span>↗</span></Link>
    </div>
   </section>
  </main>
  <footer className="landing-footer">
   <Link href="/" className="landing-brand">CASE<span>RUSH</span><i>.</i></Link>
   <span>Virtuelle € ohne Echtgeldwert · Keine Ein- oder Auszahlungen · Unabhängiges Fanprojekt.</span>
   <Link href="/cases">ZUM SPIEL ↗</Link>
  </footer>
 </div>;
}
