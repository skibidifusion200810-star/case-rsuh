'use client';
import {useEffect,useState} from 'react';
import OpeningReel from './components/OpeningReel';
import MultiOpeningReel from './components/MultiOpeningReel';
import Leaderboard from './components/Leaderboard';
import BattleArena from './components/BattleArena';
import UpgradePanel from './components/UpgradePanel';
type Item={id:string,name:string,rarity:string,value:number,weight:number,imageUrl?:string|null,priceOrigin?:string,priceCheckedAt?:string|null};
type Case={id:string,name:string,slug:string,price:number,imageUrl?:string|null,items:Item[]};
type Inv={id:string,item:Item,valueAtDrop?:number|null,isDemo?:boolean};
type User={id:string,username:string,coins:number,openSlots:number,starterClaimed:boolean};
const rarityColor:Record<string,string>={COMMON:'#9ca3af',UNCOMMON:'#44a1ff',RARE:'#9c63ff',EPIC:'#ec55cf',LEGENDARY:'#f25057',KNIFE:'#f8bc45'};
const priceNote=(i:Item)=>{const date=i.priceCheckedAt?new Date(i.priceCheckedAt).toLocaleDateString('de-DE'):'Datum unbekannt';return i.priceOrigin==='CSMONEY_TRADE'?'CS.MONEY Trade (Drittanbieter, Stand '+date+')':i.priceOrigin==='BYMYKEL_USD_SNAPSHOT'?'Alter Preis-Snapshot vom '+date+' – nicht CS.MONEY':i.priceOrigin==='CSMONEY_MARKET_REFERENCE'?'CS.MONEY-Marktreferenz (via Veriloot, Stand '+date+')':'Kein bestätigter Marktpreis'};
const fmt=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
function AssetImage({src,alt,kind}:{src?:string|null,alt:string,kind:'case'|'item'}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return src&&!broken
   ? <img src={src} alt={alt} className={'art-img art-'+kind} loading="lazy" referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>
   : <span className={'art-placeholder art-'+kind} aria-label="Bild nicht verfügbar">✦</span>;
}
export default function Home(){
 const [multiWins,setMultiWins]=useState<{item:Item,inventoryId:string}[]>([]);
 const [multiSpin,setMultiSpin]=useState<{drops:{item:Item,inventoryId:string}[],pool:Item[]}|null>(null);
 const [caseCount,setCaseCount]=useState(1);
 const [spin,setSpin]=useState<{item:Item,inventoryId:string,isDemo:boolean,pool:Item[]}|null>(null);
 const [reducedMotion,setReducedMotion]=useState(false);
 const [formMode,setFormMode]=useState<'login'|'register'>('login'),[formError,setFormError]=useState('');
 const [cases,setCases]=useState<Case[]>([]),[me,setMe]=useState<User|null>(null),[inventory,setInventory]=useState<Inv[]>([]),[tab,setTab]=useState('cases'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[login,setLogin]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[win,setWin]=useState<{item:Item,inventoryId:string,isDemo?:boolean}|null>(null),[detail,setDetail]=useState<Case|null>(null);
 async function get(url:string){const r=await fetch(url,{cache:'no-store'});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Serververbindung fehlgeschlagen ('+r.status+')')}return r.json()}
 async function refresh(){try{const [c,m]=await Promise.all([get('/api/game?action=cases'),get('/api/game?action=me')]);setCases(c.cases);setMe(m.user);setInventory(m.user?(await get('/api/game?action=inventory')).items:[]);setError('')}catch(e){setError(e instanceof Error?e.message:String(e))}}
 useEffect(()=>{void refresh();setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)},[]);
 useEffect(()=>{
  const showInventory=()=>{setTab('inventory');void refresh()};
  window.addEventListener('case-rush-show-inventory',showInventory);
  return()=>window.removeEventListener('case-rush-show-inventory',showInventory);
 },[]);
 useEffect(()=>{if(tab==='inventory')void refresh()},[tab]);
 async function act(action:string,other:Record<string,unknown>={}){setBusy(true);setError('');setFormError('');try{const r=await fetch('/api/game',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...other})});const j=await r.json().catch(()=>({error:'Server noch nicht erreichbar. Bitte später erneut versuchen.'}));if(!r.ok)throw Error(j.error||'Serverfehler ('+r.status+')');await refresh();return j}catch(e){const message=e instanceof Error?e.message:String(e);setError(message);setFormError(message);return null}finally{setBusy(false)}}
 async function open(c:Case){
  if(!me){setFormMode('login');setFormError('');setLogin(true);return}
  const count=c.price===0?1:Math.min(caseCount,me.openSlots||1);
  const j=await act('open',{caseId:c.id,count});
  if(j){
   setDetail(null);
   if(Array.isArray(j.results)){
    setMultiWins([]);
    if(reducedMotion)setMultiWins(j.results);
    else setMultiSpin({drops:j.results,pool:c.items});
   }
   else if(reducedMotion)setWin(j);
   else setSpin({...j,pool:c.items});
  }
 }
 async function sell(id:string){const j=await act('sell',{inventoryId:id});if(j){setWin(null);setMultiWins(prev=>prev.filter(x=>x.inventoryId!==id))}}
 async function sellAll(){
  if(!multiWins.length)return;
  const j=await act('sellBatch',{inventoryIds:multiWins.map(x=>x.inventoryId)});
  if(j)setMultiWins([]);
 }
 return <><header className="top"><a className="logo" href="/">CASE <b>RUSH</b><i>.</i></a><nav><button onClick={()=>setTab('cases')}>KISTEN</button><button onClick={()=>setTab('inventory')}>INVENTAR</button><button onClick={()=>setTab('battles')}>BATTLES</button><button onClick={()=>setTab('upgrades')}>UPGRADES</button><button onClick={()=>setTab('leaderboard')}>BESTENLISTE</button></nav><div className="profile">{me?<><span className="coins">{fmt(me.coins)}</span><strong>{me.username}</strong><button onClick={()=>void act('logout')}>Abmelden</button></>:<button className="primary" onClick={()=>{setFormMode("login");setFormError("");setLogin(true)}}>ANMELDEN</button>}</div></header><section className="hero"><div className="small">THE NEXT DROP IS YOURS</div><h1>YOUR CASE.<br/><em>YOUR RUSH.</em></h1><p>CS2-Skins mit Bildern aus dem ByMykel-Katalog. Alle Beträge sind virtuelle Spielwerte ohne Geldwert. Ein-Cent-Werte beruhen auf Quellen für genau die angezeigte Skin-Abnutzung. Nur explizit markierte Preise stammen aus CS.MONEY Trade.</p></section><main>{error&&<div className="error">{error}</div>}{tab==='cases'?<><div className="eyebrow">01 / THE ARSENAL</div><div className="section-head"><h2>CHOOSE YOUR <em>CASE.</em></h2><span>{cases.length.toString().padStart(2,'0')} KISTEN</span></div><div className="case-grid">{cases.map(c=><button className="case" key={c.id} onClick={()=>{setCaseCount(1);setDetail(c)}}><div className="case-visual"><AssetImage src={c.imageUrl} alt={c.name+" Kistenbild"} kind="case"/><span>CR / {c.slug.toUpperCase()}</span></div><h3>{c.name}</h3><p>{c.price===0?'KOSTENLOS':fmt(c.price)+' VIRTUELL'}</p><span className="case-bottom">ÖFFNEN →</span></button>)}</div></>:tab==='inventory'?<><h2>DEIN <em>INVENTAR</em></h2>{!me?<p>Bitte anmelden.</p>:<div className="item-grid">{inventory.map(i=><article key={i.id} className="item" style={{borderTopColor:rarityColor[i.item.rarity]}}><small>{i.item.rarity}</small><AssetImage src={i.item.imageUrl} alt={i.item.name} kind="item"/><h3>{i.item.name}</h3><p>{fmt(i.valueAtDrop??i.item.value)} <small>virtuell · Wert bei Ziehung</small></p><button className="primary" disabled={busy} onClick={()=>void sell(i.id)}>VERKAUFEN</button></article>)}</div>}</>:tab==='leaderboard'?<Leaderboard/>:tab==='upgrades'?<UpgradePanel slots={me?.openSlots??1} coins={me?.coins??0} purchase={async tier=>!!(await act('upgrade',{tier}) )}/>:<BattleArena cases={cases} me={me} onChange={refresh}/>}</main><footer>CASE RUSH · Guthaben und Itemwerte in virtuellen € ohne Geldwert · Keine Auszahlungen · Bilder/Itemdaten: ByMykel CSGO-API, CS2-Assets © jeweilige Rechteinhaber · Unabhängiges Fanprojekt.</footer>{detail&&<div className="overlay" onClick={()=>setDetail(null)}><section className="modal detail" onClick={e=>e.stopPropagation()}><button className="x" onClick={()=>setDetail(null)}>✕</button><div className="eyebrow">OPEN CASE</div><h2>{detail.name.toUpperCase()}</h2><p>{detail.price===0?'Kostenlos & unbegrenzt – nach 3 Sekunden erneut öffnen. Gratis-Gewinne sind verkaufbar.':fmt(detail.price)+' (virtuell) pro Öffnung'}</p><h3>MÖGLICHE ITEMS / DROP-CHANCEN</h3>{detail.items.map(i=><div key={i.id} className="drop"><span className="drop-title" style={{color:rarityColor[i.rarity]}}><AssetImage src={i.imageUrl} alt={i.name} kind="item"/>{i.name}</span><span>{fmt(i.value)} · {(i.weight/detail.items.reduce((a,b)=>a+b.weight,0)*100).toFixed(2)}% <small className="price-origin">{priceNote(i)}</small></span></div>)}{detail.price>0&&<div className="multi-picker">
   <div className="eyebrow">MEHRFACHÖFFNUNG · LIMIT {me?.openSlots??1}×</div>
   <div className="multi-options">{[1,2,4,8,10].map(n=><button key={n} disabled={n>(me?.openSlots??1)}
    className={caseCount===n?'active':''} onClick={()=>setCaseCount(n)}>{n}×</button>)}</div>
   <p>Gesamtpreis: <strong>{fmt(detail.price*Math.min(caseCount,me?.openSlots??1))}</strong> virtuell</p>
   {(me?.openSlots??1)<10&&<button className="multi-upgrade-link" onClick={()=>{setDetail(null);setTab('upgrades')}}>Weitere Slots freischalten →</button>}
  </div>}
 <label className="reduce-label"><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/> Bewegungen reduzieren</label>
 <button className="primary wide" disabled={busy||detail.items.length===0} onClick={()=>void open(detail)}>{busy?'LÄDT ...':detail.items.length===0?'KEINE GEPRÜFTEN PREISE':'KISTE ÖFFNEN'}</button></section></div>}{spin&&<OpeningReel winner={spin.item} pool={spin.pool} reducedMotion={reducedMotion} onFinish={()=>{setWin(spin);setSpin(null)}}/>}
 {multiSpin&&<MultiOpeningReel drops={multiSpin.drops} pool={multiSpin.pool} reducedMotion={reducedMotion} onFinish={()=>{setMultiWins(multiSpin.drops);setMultiSpin(null)}}/>}{multiWins.length>0&&<div className="overlay" onClick={()=>setMultiWins([])}>
  <section className="modal multi-modal" onClick={e=>e.stopPropagation()}>
   <button className="x" onClick={()=>setMultiWins([])}>✕</button>
   <div className="eyebrow">MULTI DROP</div><h2>{multiWins.length} <em>NEUE ITEMS.</em></h2>
   <p>Verkaufe einzelne Gewinne oder alle Items mit einem Klick.</p>
   <div className="multi-results">{multiWins.map(result=><div className="multi-result" key={result.inventoryId}>
    <AssetImage src={result.item.imageUrl} alt={result.item.name} kind="item"/>
    <strong>{result.item.name}</strong>
    <span>{fmt(result.item.value)}</span>
    <button className="primary" disabled={busy} onClick={()=>void sell(result.inventoryId)}>VERKAUFEN</button>
   </div>)}</div>
   <div className="multi-sale-summary">
    <span>{multiWins.length} ITEMS · GESAMTWERT <strong>{fmt(multiWins.reduce((sum,x)=>sum+x.item.value,0))}</strong></span>
    <button className="primary" disabled={busy} onClick={()=>void sellAll()}>{busy?'VERKAUFT…':'ALLES VERKAUFEN'}</button>
   </div>
   <button className="secondary wide" onClick={()=>setMultiWins([])}>ALLE BEHALTEN / SCHLIESSEN</button>
  </section>
 </div>}{win&&<div className="overlay"><section className="modal win"><div className="eyebrow">NEW DROP</div><div className="win-star" style={{color:rarityColor[win.item.rarity]}}><AssetImage src={win.item.imageUrl} alt={win.item.name} kind="item"/></div><small>{win.item.rarity}</small><h2>{win.item.name}</h2><p>{fmt(win.item.value)} virtuell · {priceNote(win.item)}</p><button className="primary wide" disabled={busy} onClick={()=>void sell(win.inventoryId)}>SOFORT VERKAUFEN</button><button className="wide secondary" onClick={()=>setWin(null)}>INS INVENTAR LEGEN</button></section></div>}{login&&<div className="overlay" onClick={()=>setLogin(false)}>
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
 <p className="auth-info">Neue Konten erhalten 5,00 € virtuelles Startguthaben. Die kostenlose Kiste kann unbegrenzt geöffnet werden und ihre Gewinne sind verkaufbar. Kein Echtgeld.</p>
 </form>
 </div>}</>}
