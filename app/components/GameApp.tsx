'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import OpeningReel from './OpeningReel';
import MultiOpeningReel from './MultiOpeningReel';
import Leaderboard from './Leaderboard';
import BattleArena from './BattleArena';
import UpgradePanel from './UpgradePanel';
import TradingHub from './TradingHub';
import PlayerIdentity,{XPProgress} from './PlayerIdentity';
type Item={id:string,name:string,rarity:string,value:number,weight:number,imageUrl?:string|null,priceOrigin?:string,priceCheckedAt?:string|null,priceSourceUrl?:string|null};
type Case={id:string,name:string,slug:string,price:number,originalPrice?:number,imageUrl?:string|null,items:Item[]};
type CatalogItem={id:string;name:string;rarity:string;value:number;imageUrl:string|null;case:{name:string}};
type Inv={id:string,item:Item,valueAtDrop?:number|null,isDemo?:boolean,tradeLockId?:string|null,mergedCount:number,mergedRarity?:string|null};
type User={id:string,username:string,coins:number,openSlots:number,starterClaimed:boolean,isAdmin?:boolean,xp:number,level:number};
const rarityColor:Record<string,string>={COMMON:'#9ca3af',UNCOMMON:'#44a1ff',RARE:'#9c63ff',EPIC:'#ec55cf',LEGENDARY:'#f25057',KNIFE:'#f8bc45'};
const priceNote=(i:Item)=>{const date=i.priceCheckedAt?new Date(i.priceCheckedAt).toLocaleDateString('de-DE'):'Datum unbekannt';return i.priceOrigin==='CSMONEY_TRADE'?'CS.MONEY Trade (Drittanbieter, Stand '+date+')':i.priceOrigin==='BYMYKEL_USD_SNAPSHOT'?'Alter Preis-Snapshot vom '+date+' – nicht CS.MONEY':i.priceOrigin==='CSMONEY_MARKET_REFERENCE'?'Externe Marktpreisreferenz (Stand '+date+')':'Kein bestätigter Marktpreis'};
const chance=(value:number,total:number)=>{
 const percent=total>0?value/total*100:0;
 return percent<0.01?percent.toFixed(4)+'%':percent<0.1?percent.toFixed(3)+'%':percent.toFixed(2)+'%';
};
const fmt=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
function AssetImage({src,alt,kind}:{src?:string|null,alt:string,kind:'case'|'item'}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return src&&!broken
   ? <img src={src} alt={alt} className={'art-img art-'+kind} loading="lazy" referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>
   : <span className={'art-placeholder art-'+kind} aria-label="Bild nicht verfügbar">✦</span>;
}
export default function GameApp({section}:{section:'cases'|'battles'|'inventory'|'leaderboard'|'upgrades'|'trading'}){
 const tab=section;
 const headerRef=useRef<HTMLElement>(null);
 const [headerHeight,setHeaderHeight]=useState(75);
 useEffect(()=>{
  const el=headerRef.current;
  if(!el)return;
  const measure=()=>setHeaderHeight(Math.ceil(el.getBoundingClientRect().height));
  measure();
  const observer=new ResizeObserver(measure);
  observer.observe(el);
  return()=>observer.disconnect();
 },[]);
 const [multiWins,setMultiWins]=useState<{item:Item,inventoryId:string}[]>([]);
 const [multiSaleValue,setMultiSaleValue]=useState<number|null>(null);
 const [lastOpening,setLastOpening]=useState<{caseId:string,count:number}|null>(null);
 const [multiSpin,setMultiSpin]=useState<{drops:{item:Item,inventoryId:string}[],pool:Item[]}|null>(null);
 const [caseCount,setCaseCount]=useState(1);
 const [mergeBusy,setMergeBusy]=useState(false);
 const [mergeNotice,setMergeNotice]=useState('');
 const [promoCode,setPromoCode]=useState('');
 const [promoNotice,setPromoNotice]=useState('');
 const [adminWeaponOpen,setAdminWeaponOpen]=useState(false);
 const [weaponSearch,setWeaponSearch]=useState('');
 const [weaponCatalog,setWeaponCatalog]=useState<CatalogItem[]>([]);
 const [weaponSelected,setWeaponSelected]=useState<CatalogItem|null>(null);
 const [weaponCount,setWeaponCount]=useState(1);
 const [weaponBusy,setWeaponBusy]=useState(false);
 const [weaponError,setWeaponError]=useState('');
 const [weaponNotice,setWeaponNotice]=useState('');
 const [spin,setSpin]=useState<{item:Item,inventoryId:string,isDemo:boolean,pool:Item[]}|null>(null);
 const [reducedMotion,setReducedMotion]=useState(false);
 const [formMode,setFormMode]=useState<'login'|'register'>('login'),[formError,setFormError]=useState('');
 const [cases,setCases]=useState<Case[]>([]),[me,setMe]=useState<User|null>(null),[inventory,setInventory]=useState<Inv[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[login,setLogin]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[win,setWin]=useState<{item:Item,inventoryId:string,isDemo?:boolean}|null>(null),[detail,setDetail]=useState<Case|null>(null);
 async function get(url:string){const r=await fetch(url,{cache:'no-store'});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Serververbindung fehlgeschlagen ('+r.status+')')}return r.json()}
 async function refresh(){try{const [c,m]=await Promise.all([get('/api/game?action=cases'),get('/api/game?action=me')]);setCases(c.cases);setDetail(prev=>prev?(c.cases as Case[]).find(x=>x.id===prev.id)??prev:null);setMe(m.user);setInventory(m.user?(await get('/api/game?action=inventory')).items:[]);setError('')}catch(e){setError(e instanceof Error?e.message:String(e))}}
 useEffect(()=>{void refresh();setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)},[]);
 useEffect(()=>{const mode=new URLSearchParams(window.location.search).get('auth');if(mode==='login'||mode==='register'){setFormMode(mode);setLogin(true)}},[]);
 useEffect(()=>{
  const showInventory=()=>{window.location.assign('/inventory')};
  window.addEventListener('case-rush-show-inventory',showInventory);
  return()=>window.removeEventListener('case-rush-show-inventory',showInventory);
 },[]);
 useEffect(()=>{if(tab==='inventory')void refresh()},[tab]);
 useEffect(()=>{
  const sync=()=>{void refresh()};
  window.addEventListener('cr-event-updated',sync);
  return()=>window.removeEventListener('cr-event-updated',sync);
 },[]);
 useEffect(()=>{
  const updated=()=>{void refresh()};
  window.addEventListener('cr-balance-changed',updated);
  const interval=window.setInterval(async()=>{
   try{
    const response=await fetch('/api/game?action=me',{cache:'no-store'});
    if(response.ok){const data=await response.json();setMe(data.user)}
   }catch{/* Keep last known balance while temporarily offline */}
  },15000);
  return()=>{window.removeEventListener('cr-balance-changed',updated);window.clearInterval(interval)};
 },[]);
 async function act(action:string,other:Record<string,unknown>={}){setBusy(true);setError('');setFormError('');try{const r=await fetch('/api/game',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...other})});const j=await r.json().catch(()=>({error:'Server noch nicht erreichbar. Bitte später erneut versuchen.'}));if(!r.ok)throw Error(j.error||'Serverfehler ('+r.status+')');await refresh();return j}catch(e){const message=e instanceof Error?e.message:String(e);setError(message);setFormError(message);return null}finally{setBusy(false)}}
 async function open(c:Case,requestedCount?:number){
  if(!me){setFormMode('login');setFormError('');setLogin(true);return}
  const count=c.price===0?1:requestedCount??caseCount;
  if(!Number.isInteger(count)||count<1||count>(me.openSlots||1)){
   setError('Für diese Anzahl benötigst du das passende Mehrfachöffnungs-Upgrade.');
   return;
  }
  const j=await act('open',{caseId:c.id,count});
  if(j){
   setDetail(null);
   setLastOpening({caseId:c.id,count});
   setMultiSaleValue(null);
   if(Array.isArray(j.results)){
    setMultiWins([]);
    if(reducedMotion)setMultiWins(j.results);
    else setMultiSpin({drops:j.results,pool:c.items});
   }
   else if(reducedMotion)setWin(j);
   else setSpin({...j,pool:c.items});
  }
 }
 useEffect(()=>{
  if(!adminWeaponOpen||!me?.isAdmin)return;
  let active=true;
  const timer=setTimeout(async()=>{
   try{
    const r=await fetch('/api/admin?view=weaponCatalog&q='+encodeURIComponent(weaponSearch),{cache:'no-store'});
    const j=await r.json();
    if(!r.ok)throw Error(j.error||'Waffenkatalog konnte nicht geladen werden');
    if(active)setWeaponCatalog(j.items||[]);
   }catch(e){if(active)setWeaponError(e instanceof Error?e.message:'Laden fehlgeschlagen')}
  },250);
  return()=>{active=false;clearTimeout(timer)};
 },[adminWeaponOpen,weaponSearch,me?.isAdmin]);
 async function addAdminWeapon(){
  if(!me?.isAdmin||!weaponSelected||weaponBusy)return;
  setWeaponBusy(true);setWeaponError('');
  try{
   const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'grantInventoryItem',itemId:weaponSelected.id,count:weaponCount,userId:me.id})});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Waffe konnte nicht hinzugefügt werden');
   setWeaponNotice(weaponCount+'× '+weaponSelected.name+' zum Inventar hinzugefügt.');
   setAdminWeaponOpen(false);setWeaponSelected(null);
   await refresh();
  }catch(e){setWeaponError(e instanceof Error?e.message:'Fehler')}
  finally{setWeaponBusy(false)}
 }
 async function mergeAllDuplicates(){
  if(mergeBusy||busy)return;
  const groups=new Map<string,number>();
  for(const row of inventory)if(!row.tradeLockId&&!row.isDemo)groups.set(row.item.id,(groups.get(row.item.id)||0)+1);
  const count=[...groups.values()].filter(n=>n>=2).length;
  if(!count)return;
  if(!window.confirm(count+' Duplikat-Gruppen zusammenführen? Pro Gruppe bleibt eine Waffe mit dem gesamten virtuellen Wert erhalten. Eine Seltenheits-Aufwertung ist zufällig möglich.'))return;
  setMergeBusy(true);setError('');setMergeNotice('');
  try{
   const response=await fetch('/api/merge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'mergeAll'})});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Merge fehlgeschlagen');
   const upgrades=(body.results as Array<{upgraded:boolean}>).filter(x=>x.upgraded).length;
   setMergeNotice(body.results.length+' Duplikat-Gruppen gemergt. '+upgrades+' Seltenheits-Aufwertungen!');
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Mergen fehlgeschlagen')}
  finally{setMergeBusy(false)}
 }
 async function redeemPromo(){
  if(!promoCode.trim()||busy)return;
  setBusy(true);setPromoNotice('');
  try{
   const r=await fetch('/api/promo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:promoCode})});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Code ungültig');
   setPromoNotice('Code eingelöst: '+(j.reward.coins?fmt(j.reward.coins):'')+(j.reward.item?' + Skin':''));
   setPromoCode('');await refresh();
  }catch(e){setPromoNotice(e instanceof Error?e.message:'Code fehlgeschlagen')}
  finally{setBusy(false)}
 }
 async function sell(id:string){const j=await act('sell',{inventoryId:id});if(j){setWin(null);setMultiWins(prev=>prev.filter(x=>x.inventoryId!==id))}}
 async function sellAll(){
  if(!multiWins.length)return;
  const j=await act('sellBatch',{inventoryIds:multiWins.map(x=>x.inventoryId)});
  if(j){setMultiWins([]);setMultiSaleValue(j.value)}
 }
 async function reopen(){
  if(!lastOpening||busy)return;
  const c=cases.find(x=>x.id===lastOpening.caseId);
  if(!c){setError('Kiste nicht mehr verfügbar.');return}
  if(!me){setLogin(true);return}
  if(me.coins<c.price*lastOpening.count){
   setError('Nicht genügend virtuelles Guthaben für die gleiche Öffnung.');
   return;
  }
  const count=lastOpening.count;
  setWin(null);
  setMultiWins([]);
  setMultiSaleValue(null);
  await open(c,count);
 }
 const previousCase=lastOpening?cases.find(x=>x.id===lastOpening.caseId):null;
 const canReopen=!!me&&!!previousCase&&!busy&&
  me.coins>=previousCase.price*lastOpening!.count&&
  lastOpening!.count<=(me.openSlots||1);
 const reopenLabel=previousCase&&lastOpening?
  'ERNEUT ÖFFNEN · '+lastOpening.count+'× '+previousCase.name+' · '+fmt(previousCase.price*lastOpening.count):'ERNEUT ÖFFNEN';
 return <><header ref={headerRef} className="top game-header">
  <Link className="logo game-logo" href="/">CASE <b>RUSH</b><i>.</i></Link>
  <nav aria-label="Hauptnavigation">
   <Link href="/" className="game-nav-link">START</Link>
   <Link href="/cases" className={'game-nav-link '+(tab==='cases'?'active':'')} aria-current={tab==='cases'?'page':undefined}>KISTEN</Link>
   <Link href="/battles" className={'game-nav-link '+(tab==='battles'?'active':'')} aria-current={tab==='battles'?'page':undefined}>CASE BATTLES</Link>
   <Link href="/inventory" className={'game-nav-link '+(tab==='inventory'?'active':'')} aria-current={tab==='inventory'?'page':undefined}>INVENTAR</Link>
   <Link href="/leaderboard" className={'game-nav-link '+(tab==='leaderboard'?'active':'')} aria-current={tab==='leaderboard'?'page':undefined}>BESTENLISTE</Link>
   <Link href="/upgrades" className={'game-nav-link '+(tab==='upgrades'?'active':'')} aria-current={tab==='upgrades'?'page':undefined}>UPGRADES</Link>
   <Link href="/trading" className={'game-nav-link '+(tab==='trading'?'active':'')} aria-current={tab==='trading'?'page':undefined}>TRADING</Link>
   {me?.isAdmin&&<Link href="/admin" className="game-nav-link game-admin-link">ADMIN ↗</Link>}
   <button type="button" className="game-nav-link" onClick={()=>window.dispatchEvent(new Event('cr-open-chat'))}>LIVE CHAT</button>
  </nav>
  <div className="profile">{me?<><span className="coins">{fmt(me.coins)}</span><div className="cr-header-player"><PlayerIdentity username={me.username} xp={me.xp} isAdmin={me.isAdmin}/><XPProgress xp={me.xp}/></div><button onClick={()=>void act('logout')}>ABMELDEN</button></>:<button className="primary" onClick={()=>{setFormMode('login');setFormError('');setLogin(true)}}>ANMELDEN</button>}</div>
 </header>
 <div aria-hidden="true" style={{height:headerHeight,flexShrink:0}}/>
 <section className="game-page-intro">
  <div className="game-intro-inner">
   <div className="eyebrow">CASE RUSH <span className="intro-slash">/</span> {({cases:'ARSENAL',battles:'ARENA',inventory:'COLLECTION',leaderboard:'RANKINGS',upgrades:'PROGRESSION',trading:'MARKETPLACE'} as Record<string,string>)[tab]}</div>
   <div className="game-intro-row">
    <h1>{({cases:'DEINE NÄCHSTE KISTE.',battles:'DIE ARENA WARTET.',inventory:'DEINE SAMMLUNG.',leaderboard:'DIE BESTEN SPIELER.',upgrades:'MEHR POWER.',trading:'TRADE. MERGE. COLLECT.'} as Record<string,string>)[tab]}</h1>
    <p>{({cases:'Öffne Kisten, entdecke Skins und verwalte deine virtuellen Gewinne.',battles:'Stelle dein Duell zusammen und tritt gegen Spieler oder Bots an.',inventory:'Alle gezogenen Items an einem Ort – behalten oder verkaufen.',leaderboard:'Vergleiche Guthaben, Inventarwert und Kistenöffnungen.',upgrades:'Schalte bis zu zehn gleichzeitige Kistenöffnungen frei.',trading:'Tausche Skins mit Spielern oder merge identische Waffen.'} as Record<string,string>)[tab]}</p>
   </div>
  </div>
 </section><main className="game-main">{error&&<div className="error">{error}</div>}{tab==='cases'?<><div className="eyebrow">01 / THE ARSENAL</div><div className="section-head"><h2>CHOOSE YOUR <em>CASE.</em></h2><span>{cases.length.toString().padStart(2,'0')} KISTEN</span></div><div className="case-grid">{cases.map(c=><button className="case" key={c.id} onClick={()=>{setCaseCount(1);setDetail(c)}}><div className="case-visual"><AssetImage src={c.imageUrl} alt={c.name+" Kistenbild"} kind="case"/><span>CR / {c.slug.toUpperCase()}</span></div><h3>{c.name}</h3><p>{c.price===0?'KOSTENLOS':<>
        {c.originalPrice!==undefined&&c.originalPrice>c.price&&<del className="event-old-price">{fmt(c.originalPrice)}</del>}
        {fmt(c.price)} VIRTUELL
       </>}</p><span className="case-bottom">ÖFFNEN →</span></button>)}</div></>:tab==='inventory'?<><h2>DEIN <em>INVENTAR</em></h2><div className="trading-inventory-cta"><div><strong>ALLE DUPLIKATE MERGEN</strong><p>Alle identischen und nicht reservierten Waffen zusammenführen. Jede Gruppe hat eine 10%-Chance auf +1 Seltenheitsstufe; ein Luck-Event erhöht diese Chance (maximal 50%). Der virtuelle Gesamtwert bleibt erhalten.</p></div><button className="primary" disabled={busy||mergeBusy||!me||![...inventory.reduce((m,row)=>{if(!row.tradeLockId&&!row.isDemo)m.set(row.item.id,(m.get(row.item.id)||0)+1);return m},new Map<string,number>()).values()].some(n=>n>=2)} onClick={()=>void mergeAllDuplicates()}>{mergeBusy?'MERGE LÄUFT …':'✦ ALLE DUPLIKATE MERGEN'}</button><Link href="/trading" className="secondary">TRADING ↗</Link></div>{mergeNotice&&<p className="admin-notice" role="status">{mergeNotice}</p>}{me&&<div className="cr-promo-redemption"><strong>ADMIN-CODE EINLÖSEN</strong><input aria-label="Promo-Code" value={promoCode} onChange={e=>setPromoCode(e.target.value)} placeholder="CODE EINGEBEN"/><button className="secondary" disabled={busy||!promoCode.trim()} onClick={()=>void redeemPromo()}>EINLÖSEN</button>{promoNotice&&<span role="status">{promoNotice}</span>}</div>}{weaponNotice&&<p className="admin-notice" role="status">{weaponNotice}</p>}{me?.isAdmin&&<button className="primary" type="button" onClick={()=>{setWeaponError('');setAdminWeaponOpen(true)}}>+ WAFFE HINZUFÜGEN · ADMIN</button>}{!me?<p>Bitte anmelden.</p>:<div className="item-grid">{inventory.map(i=><article key={i.id} className="item" style={{borderTopColor:rarityColor[i.mergedRarity??i.item.rarity]}}><small>{i.mergedRarity??i.item.rarity}{i.mergedRarity&&i.mergedRarity!==i.item.rarity?' · UPGRADED':''}</small><AssetImage src={i.item.imageUrl} alt={i.item.name} kind="item"/><h3>{i.item.name}</h3><p>{fmt(i.valueAtDrop??i.item.value)} <small>virtuell · Wert bei Ziehung</small></p>{(i.mergedCount??1)>1&&<p className='merged-tag'>MERGED ×{i.mergedCount}</p>}{i.tradeLockId&&<p className='locked-tag'>IN TRADE RESERVIERT</p>}<button className="primary" disabled={busy||!!i.tradeLockId} onClick={()=>void sell(i.id)}>VERKAUFEN</button></article>)}</div>}</>:tab==='leaderboard'?<Leaderboard/>:tab==='upgrades'?<UpgradePanel slots={me?.openSlots??1} coins={me?.coins??0} purchase={async tier=>!!(await act('upgrade',{tier}) )}/>:tab==='trading'?<TradingHub/>:<BattleArena cases={cases} me={me} onChange={refresh}/>}</main><footer>CASE RUSH · Guthaben und Itemwerte in virtuellen € ohne Geldwert · Keine Auszahlungen · Bilder/Itemdaten: ByMykel CSGO-API, CS2-Assets © jeweilige Rechteinhaber · Unabhängiges Fanprojekt.</footer>{detail&&<div className="overlay" onClick={()=>setDetail(null)}><section className="modal detail" onClick={e=>e.stopPropagation()}><button className="x" onClick={()=>setDetail(null)}>✕</button><div className="eyebrow">OPEN CASE</div><h2>{detail.name.toUpperCase()}</h2><p>{detail.price===0?'Kostenlos & unbegrenzt – nach 3 Sekunden erneut öffnen. Gratis-Gewinne sind verkaufbar.':<>
       {detail.originalPrice!==undefined&&detail.originalPrice>detail.price&&<del className="event-old-price">{fmt(detail.originalPrice)}</del>}
       {fmt(detail.price)} (virtuell) pro Öffnung
      </>}</p><h3>MÖGLICHE ITEMS / DROP-CHANCEN</h3><p className="drop-explainer">Die Prozentwerte sind deine echten Gewinnchancen pro Öffnung. Die Preise sind virtuelle Verkaufswerte, keine auszahlbaren Marktpreise.</p>
 <div className="drop-head"><span>WAFFE / ZUSTAND</span><span>VIRTUELLER WERT</span><span>CHANCE</span></div>
 {detail.items.slice().sort((a,b)=>b.value-a.value).map(i=><div key={i.id} className="drop">
   <div className="drop-title"><AssetImage src={i.imageUrl} alt={i.name} kind="item"/><strong style={{color:rarityColor[i.rarity]}}>{i.name}</strong></div>
   <div className="drop-price">{fmt(i.value)}</div>
   <div className="drop-odds">{chance(i.weight,detail.items.reduce((sum,x)=>sum+x.weight,0))}</div>
   <div className="drop-source"><span>{priceNote(i)}</span>{i.priceSourceUrl&&<a href={i.priceSourceUrl} target="_blank" rel="noopener noreferrer">Preisquelle ansehen</a>}</div>
 </div>)}{detail.price>0&&<div className="multi-picker">
   <div className="eyebrow">MEHRFACHÖFFNUNG · LIMIT {me?.openSlots??1}×</div>
   <div className="multi-options">{[1,2,4,8,10].map(n=><button key={n} disabled={n>(me?.openSlots??1)}
    className={caseCount===n?'active':''} onClick={()=>setCaseCount(n)}>{n}×</button>)}</div>
   <p>Gesamtpreis: <strong>{fmt(detail.price*Math.min(caseCount,me?.openSlots??1))}</strong> virtuell</p>
   {(me?.openSlots??1)<10&&<button className="multi-upgrade-link" onClick={()=>{window.location.assign('/upgrades')}}>Weitere Slots freischalten →</button>}
  </div>}
 <label className="reduce-label"><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/> Bewegungen reduzieren</label>
 <button className="primary wide" disabled={busy||detail.items.length===0} onClick={()=>void open(detail)}>{busy?'LÄDT ...':detail.items.length===0?'KEINE GEPRÜFTEN PREISE':'KISTE ÖFFNEN'}</button></section></div>}{spin&&<OpeningReel winner={spin.item} pool={spin.pool} reducedMotion={reducedMotion} onFinish={()=>{setWin(spin);setSpin(null)}}/>}
 {multiSpin&&<MultiOpeningReel drops={multiSpin.drops} pool={multiSpin.pool} reducedMotion={reducedMotion} onFinish={()=>{setMultiWins(multiSpin.drops);setMultiSpin(null)}}/>}{(multiWins.length>0||multiSaleValue!==null)&&<div className="overlay" onClick={()=>{setMultiWins([]);setMultiSaleValue(null)}}>
  <section className="modal multi-modal" onClick={e=>e.stopPropagation()}>
   <button className="x" onClick={()=>{setMultiWins([]);setMultiSaleValue(null)}}>✕</button>
   <div className="eyebrow">MULTI DROP</div><h2>{multiSaleValue!==null?'ALLE ITEMS':'DEINE '+multiWins.length} <em>{multiSaleValue!==null?'VERKAUFT.':'GEWINNE.'}</em></h2>
   <p>{multiSaleValue!==null?'Dein Verkaufserlös wurde deinem virtuellen Guthaben gutgeschrieben: '+fmt(multiSaleValue):'Verkaufe einzelne Gewinne oder alle Items mit einem Klick.'}</p>
   <div className="multi-results">{multiWins.map(result=><div className="multi-result" key={result.inventoryId}>
    <AssetImage src={result.item.imageUrl} alt={result.item.name} kind="item"/>
    <strong>{result.item.name}</strong>
    <span>{fmt(result.item.value)}</span>
    <button className="primary" disabled={busy} onClick={()=>void sell(result.inventoryId)}>VERKAUFEN</button>
   </div>)}</div>
   {multiWins.length>0&&<div className="multi-sale-summary">
    <span>{multiWins.length} ITEMS · GESAMTWERT <strong>{fmt(multiWins.reduce((sum,x)=>sum+x.item.value,0))}</strong></span>
    <button className="primary" disabled={busy} onClick={()=>void sellAll()}>{busy?'VERKAUFT…':'ALLES VERKAUFEN'}</button>
   </div>}
   {lastOpening&&<button className="primary wide reopen" disabled={!canReopen} onClick={()=>void reopen()}>{reopenLabel}</button>}
   <button className="secondary wide" onClick={()=>{setMultiWins([]);setMultiSaleValue(null)}}>SCHLIESSEN / ITEMS BEHALTEN</button>
  </section>
 </div>}{win&&<div className="overlay"><section className="modal win"><div className="eyebrow">NEW DROP</div><div className="win-star" style={{color:rarityColor[win.item.rarity]}}><AssetImage src={win.item.imageUrl} alt={win.item.name} kind="item"/></div><small>{win.item.rarity}</small><h2>{win.item.name}</h2><p>{fmt(win.item.value)} virtuell · {priceNote(win.item)}</p><button className="primary wide" disabled={busy} onClick={()=>void sell(win.inventoryId)}>SOFORT VERKAUFEN</button>{lastOpening&&<button className="primary wide reopen" disabled={!canReopen} onClick={()=>void reopen()}>{reopenLabel}</button>}<button className="wide secondary" onClick={()=>setWin(null)}>INS INVENTAR LEGEN</button></section></div>}{adminWeaponOpen&&me?.isAdmin&&<div className="overlay cr-admin-weapon-layer" onMouseDown={e=>{if(e.target===e.currentTarget)setAdminWeaponOpen(false)}}>
  <section className="modal cr-admin-weapon-modal" role="dialog" aria-modal="true" aria-label="Waffen zum Inventar hinzufügen">
   <button className="x" type="button" onClick={()=>setAdminWeaponOpen(false)}>✕</button>
   <div className="eyebrow">ADMIN / INVENTAR</div><h2>WAFFE <em>HINZUFÜGEN.</em></h2>
   <p>Wähle eine Waffe aus dem vorhandenen Spielkatalog. Die Zuteilung wird protokolliert.</p>
   <input aria-label="Waffe suchen" placeholder="Waffe oder Skin suchen…" value={weaponSearch} onChange={e=>setWeaponSearch(e.target.value)} />
   <div className="cr-admin-weapon-grid">{weaponCatalog.map(w=><button key={w.id} type="button" className={'cr-admin-weapon-card'+(weaponSelected?.id===w.id?' selected':'')} onClick={()=>setWeaponSelected(w)}>
    {w.imageUrl?<img src={w.imageUrl} alt={w.name} loading="lazy" referrerPolicy="no-referrer"/>:<span>✦</span>}
    <strong>{w.name}</strong><small>{w.rarity} · {fmt(w.value)} virtuell</small>
   </button>)}</div>
   {weaponSelected&&<div className="cr-admin-weapon-selection">
    <div><strong>{weaponSelected.name}</strong><small>{weaponSelected.rarity} · {fmt(weaponSelected.value)} virtuell</small></div>
    <label>ANZAHL <input type="number" min={1} max={10} step={1} value={weaponCount} onChange={e=>setWeaponCount(Number(e.target.value))}/></label>
   </div>}
   {weaponError&&<p className="error" role="alert">{weaponError}</p>}
   <button className="primary wide" disabled={weaponBusy||!weaponSelected||!Number.isInteger(weaponCount)||weaponCount<1||weaponCount>10} onClick={()=>void addAdminWeapon()}>{weaponBusy?'WIRD HINZUGEFÜGT …':'AUSGEWÄHLTE WAFFE HINZUFÜGEN'}</button>
  </section>
 </div>}{login&&<div className="overlay" onClick={()=>setLogin(false)}>
 <form className="modal auth" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();const j=await act(formMode,{username,password});if(j){setLogin(false);setPassword('')}}}>
 <button type="button" className="x" onClick={()=>setLogin(false)}>✕</button>
 <div className="eyebrow">DEIN ACCOUNT</div><h2>{formMode==='register'?'KONTO ERSTELLEN':'EINLOGGEN'}</h2>
 <label htmlFor="cr-user">Benutzername</label>
 <input id="cr-user" autoComplete="username" value={username} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" onChange={e=>setUsername(e.target.value)} placeholder="3–24 Zeichen, Buchstaben/Zahlen/_" required/>
 <label htmlFor="cr-password">Passwort</label>
 <input id="cr-password" autoComplete={formMode==='register'?'new-password':'current-password'} value={password} minLength={10} maxLength={128} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mindestens 10 Zeichen" required/>
 {formError&&<div className="auth-error" role="alert">{formError}</div>}
 <button className="primary wide" type="submit" disabled={busy}>{busy?'BITTE WARTEN...':formMode==='register'?'KONTO ERSTELLEN':'ANMELDEN'}</button>
 <button className="secondary wide" type="button" disabled={busy} onClick={()=>{setFormMode(formMode==='login'?'register':'login');setFormError('');setError('')}}>{formMode==='login'?'NOCH KEIN KONTO? REGISTRIEREN':'SCHON REGISTRIERT? ANMELDEN'}</button>
 <p className="auth-info">Neue Konten erhalten 1.000,00 € virtuelles Startguthaben. Die kostenlose Kiste kann unbegrenzt geöffnet werden und ihre Gewinne sind verkaufbar. Kein Echtgeld.</p>
 </form>
 </div>}</>}
