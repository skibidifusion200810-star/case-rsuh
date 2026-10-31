'use client';
import {useEffect,useState} from 'react';

type CSCase={id:string;name:string;price:number;imageUrl?:string|null};
type Player={username:string;coins:number};
type Drop={id?:string;name?:string;value:number|null;imageUrl?:string|null;rarity?:string};
type Battle={
 id:string;status:string;againstBot:boolean;creator:string;guest:string|null;
 viewerRole:'creator'|'guest'|'spectator';winner:'creator'|'guest'|null;
 case:CSCase|null;creatorDrop:Drop|null;guestDrop:Drop|null;createdAt:string;
};
const euro=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v/100);
export default function BattleArena({cases,me,onChange}:{cases:CSCase[],me:Player|null,onChange:()=>Promise<void>}){
 const allowed=cases.filter(c=>c.price>0);
 const [chosen,setChosen]=useState('');
 const [mode,setMode]=useState<'bot'|'player'>('bot');
 const [battles,setBattles]=useState<Battle[]>([]);
 const [current,setCurrent]=useState<Battle|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState<'open'|'recent'>('open');
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const response=await fetch('/api/battles',{cache:'no-store'});
    if(!response.ok)throw Error('Battles momentan nicht erreichbar');
    const json=await response.json() as {battles:Battle[]};
    if(active){
     setBattles(json.battles);
     setCurrent(old=>old?(json.battles.find(b=>b.id===old.id)??old):null);
     setError('');
    }
   }catch(e){if(active)setError(e instanceof Error?e.message:'Fehler beim Laden')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),4000);
  return()=>{active=false;window.clearInterval(timer)};
 },[reload]);
 useEffect(()=>{if(!chosen&&allowed.length)setChosen(allowed[0].id)},[chosen,allowed]);
 async function action(type:'create'|'join'|'cancel',extra:Record<string,unknown>){
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/battles',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:type,...extra})});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Battle fehlgeschlagen');
   setCurrent(json.battle);
   setReload(n=>n+1);
   await onChange();
  }catch(e){setError(e instanceof Error?e.message:'Serverfehler')}
  finally{setLoading(false)}
 }
 const selected=allowed.find(c=>c.id===chosen);
 const list=filter==='open'?battles.filter(b=>b.status==='WAITING'&&!b.againstBot):battles;
 return <section className="battles" aria-label="Case Battles">
  <div className="eyebrow">02 / CASE BATTLES</div>
  <h2>CASE <em>BATTLES.</em></h2>
  <p className="battle-intro">Fordere andere Spieler heraus oder kämpfe direkt gegen einen RUSH BOT. Gleiche Kiste, zwei Drops, der höhere Gesamtwert gewinnt. Alles nur mit virtuellen Euro.</p>
  {error&&<div role="alert" className="error">{error}</div>}
  <div className="battle-create">
   <div>
    <div className="eyebrow">CREATE YOUR BATTLE</div>
    <h3>NEUES DUELL</h3>
    <label htmlFor="battle-case">Kiste auswählen</label>
    <select id="battle-case" value={chosen} onChange={e=>setChosen(e.target.value)}>
     {allowed.map(c=><option key={c.id} value={c.id}>{c.name} · {euro(c.price)}</option>)}
    </select>
    <div className="battle-modes" role="group" aria-label="Gegnertyp">
     <button className={mode==='bot'?'active':''} onClick={()=>setMode('bot')}>GEGEN BOT</button>
     <button className={mode==='player'?'active':''} onClick={()=>setMode('player')}>ECHTER SPIELER</button>
    </div>
    <button className="primary wide" disabled={loading||!me||!selected||me.coins<selected.price}
      onClick={()=>void action('create',{caseId:chosen,againstBot:mode==='bot'})}>
     {loading?'WIRD ERSTELLT…':!me?'ZUM SPIELEN ANMELDEN':selected&&me.coins<selected.price?'NICHT GENÜGEND GUTHABEN':'BATTLE ERSTELLEN · '+euro(selected?.price??0)}
    </button>
   </div>
   <div className="battle-rules">
    <div className="eyebrow">HOW IT WORKS</div>
    <div className="battle-rule"><b>01</b><span>Beide Teilnehmer zahlen denselben Kistenpreis; Bots sind virtuelle Gegner.</span></div>
    <div className="battle-rule"><b>02</b><span>Der Server zieht für jeden Teilnehmer unabhängig mit denselben Drop-Chancen.</span></div>
    <div className="battle-rule"><b>03</b><span>Der höhere Gesamtwert gewinnt beide Items. Bei Gleichstand entscheidet der Zufall.</span></div>
    <div className="battle-rule"><b>04</b><span>Bei einem Bot-Sieg verfallen die Drops. Offene PvP-Battles kannst du abbrechen und erhältst deinen Einsatz zurück.</span></div>
   </div>
  </div>
  <div className="battle-list-head">
   <div className="eyebrow">ACTIVE ARENA</div>
   <div className="battle-filters"><button className={filter==='open'?'active':''} onClick={()=>setFilter('open')}>OFFENE BATTLES</button><button className={filter==='recent'?'active':''} onClick={()=>setFilter('recent')}>LETZTE BATTLES</button></div>
  </div>
  <div className="battle-list">
   {list.length===0?<p className="battle-empty">Noch keine Battles in dieser Kategorie. Erstelle das erste Duell!</p>:
   list.map(b=><div key={b.id} className="battle-row">
    <div className="battle-case-preview">{b.case?.imageUrl?<img src={b.case.imageUrl} alt={b.case.name}/>:<span>▰</span>}</div>
    <div className="battle-row-name"><strong>{b.case?.name??'Kiste'}</strong><small>{b.creator} VS {b.guest??'OFFEN'}</small></div>
    <div className="battle-row-price">{euro(b.case?.price??0)}<small>{b.status==='WAITING'?'WARTET AUF SPIELER':b.status==='FINISHED'?'BEENDET':'ABGEBROCHEN'}</small></div>
    <button className="secondary" onClick={()=>setCurrent(b)}>ANSEHEN</button>
    {b.status==='WAITING'&&b.viewerRole==='spectator'&&me&&
     <button className="primary" disabled={loading||me.coins<(b.case?.price??Infinity)} onClick={()=>void action('join',{battleId:b.id})}>BEITRETEN</button>}
    {b.status==='WAITING'&&b.viewerRole==='creator'&&
     <button className="battle-cancel" disabled={loading} onClick={()=>void action('cancel',{battleId:b.id})}>ABBRECHEN</button>}
   </div>)}
  </div>
  {current&&<div className="overlay" onClick={()=>setCurrent(null)}>
   <section className="modal battle-modal" role="dialog" aria-label="Battle-Ergebnis" onClick={e=>e.stopPropagation()}>
    <button className="x" onClick={()=>setCurrent(null)}>✕</button>
    <div className="eyebrow">BATTLE #{current.id.slice(0,8).toUpperCase()}</div>
    <h2>{current.status==='WAITING'?'GEGNER GESUCHT':current.status==='CANCELED'?'BATTLE ABGEBROCHEN':'BATTLE ERGEBNIS'}</h2>
    <p>{current.case?.name} · {euro(current.case?.price??0)} Einsatz pro Person</p>
    {current.status==='WAITING'?<p>Dein Einsatz ist reserviert. Das Battle wird automatisch beendet, sobald jemand beitritt.</p>:
     current.status==='CANCELED'?<p>Der Einsatz wurde dem Ersteller zurückerstattet.</p>:
     <div className="battle-versus">
      {(['creator','guest'] as const).map(side=>{
       const drop=side==='creator'?current.creatorDrop:current.guestDrop;
       const username=side==='creator'?current.creator:current.guest;
       return <div key={side} className={'battle-contestant '+(current.winner===side?'winner':'')}>
        <div className="battle-name">{username}</div>
        <div className="battle-drop">{drop?.imageUrl?<img src={drop.imageUrl} alt={drop.name??''}/>:<span>✦</span>}</div>
        <strong>{drop?.name}</strong>
        <div className="battle-drop-price">{euro(drop?.value??0)}</div>
        <div className="battle-result">{current.winner===side?'GEWINNER':'VERLOREN'}</div>
       </div>
      })}
     </div>}
    {current.status==='FINISHED'&&<p>Der Sieger erhält beide Skins im Inventar. Gegen einen Bot gibt es keine Echtgeldgewinne.</p>}
    <button className="secondary wide" onClick={()=>setCurrent(null)}>SCHLIESSEN</button>
   </section>
  </div>}
 </section>
}
