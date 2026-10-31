'use client';
import {useCallback,useEffect,useState} from 'react';

type EventInfo={id:string;discountPercent:number;luckMultiplier:number;startsAt:string;endsAt:string};
type Audit={id:string;action:string;createdAt:string;actorUsername:string;details:string};
const durations=[1,5,10,15,30,60,120];
const luckOptions=[100,125,150,200,250,300,400,500];
const discounts=[0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90];
const formatTime=(s:string)=>new Date(s).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'});
const clock=(ms:number)=>{
 const total=Math.max(0,Math.ceil(ms/1000));
 const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
 return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
};
export default function AdminEventControls(){
 const [discount,setDiscount]=useState(50);
 const [luck,setLuck]=useState(100);
 const [duration,setDuration]=useState(10);
 const [active,setActive]=useState<EventInfo|null>(null);
 const [logs,setLogs]=useState<Audit[]>([]);
 const [now,setNow]=useState(Date.now());
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const load=useCallback(async()=>{
  try{
   const response=await fetch('/api/admin?view=events',{cache:'no-store'});
   const j=await response.json();
   if(!response.ok)throw Error(j.error||'Eventdaten nicht erreichbar');
   setActive(j.event??null);
   setLogs(j.recent??[]);
  }catch(e){setError(e instanceof Error?e.message:'Event-Fehler')}
 },[]);
 useEffect(()=>{
  void load();
  const timer=setInterval(()=>{void load()},5000);
  const ticker=setInterval(()=>setNow(Date.now()),1000);
  return()=>{clearInterval(timer);clearInterval(ticker)};
 },[load]);
 const running=!!active&&new Date(active.endsAt).getTime()>now;
 const priceExample=Math.max(1,Math.ceil(7500*(100-discount)/100));
 async function submit(action:'startEvent'|'stopEvent'){
  if(busy)return;
  const description=action==='startEvent'?
   duration+' Minuten Event starten: '+discount+' % Rabatt und '+(luck/100).toLocaleString('de-DE')+'× Luck?':
   'Laufendes Event für alle Spieler sofort beenden?';
  if(!window.confirm(description))return;
  setBusy(true);setError('');setMessage('');
  try{
   const res=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action,discountPercent:discount,luckMultiplier:luck,durationMinutes:duration})});
   const j=await res.json();
   if(!res.ok)throw Error(j.error||'Aktion fehlgeschlagen');
   setMessage(action==='startEvent'?'Event läuft jetzt für alle Spieler.':'Das Event wurde beendet.');
   await load();
   window.dispatchEvent(new Event('cr-event-updated'));
  }catch(e){setError(e instanceof Error?e.message:'Eventaktion fehlgeschlagen')}
  finally{setBusy(false)}
 }
 return <div className="admin-events">
  <section className="admin-section">
   <div className="admin-section-head"><h2>GLOBAL EVENTS</h2><span>ALLE SPIELER · SERVERSEITIG</span></div>
   <p className="admin-help">Starte einen Rabatt, einen Luck-Boost oder beides gleichzeitig. Der Timer läuft auf dem Server und beendet das Event automatisch.</p>
   {running?<div className="admin-event-active">
    <div className="admin-event-running-label"><span className="admin-event-pulse"/> LIVE EVENT AKTIV</div>
    <strong className="admin-event-timer">{clock(new Date(active.endsAt).getTime()-now)}</strong>
    <div className="admin-event-active-effects">
     <span>{active.discountPercent>0?active.discountPercent+' % RABATT':'KEIN RABATT'}</span>
     <span>{(active.luckMultiplier/100).toLocaleString('de-DE')}× LUCK</span>
    </div>
    <p>Automatisches Ende: {formatTime(active.endsAt)}</p>
    <button className="admin-event-stop" disabled={busy} onClick={()=>void submit('stopEvent')}>■ EVENT SOFORT BEENDEN</button>
   </div>:<div className="admin-event-idle"><span>◉</span><strong>KEIN AKTIVES EVENT</strong><p>Alle Kisten haben normale Preise und Gewinnchancen.</p></div>}
   <div className="admin-event-editor">
    <div className="admin-kicker">EVENT KONFIGURIEREN</div>
    <div className="admin-event-choices">
     <label>RABATT AUF KISTEN
      <select value={discount} onChange={e=>setDiscount(Number(e.target.value))} disabled={running}>
       {discounts.map(n=><option key={n} value={n}>{n===0?'Kein Rabatt':n+' % Rabatt'}</option>)}
      </select>
     </label>
     <label>LUCK-MULTIPLIKATOR
      <select value={luck} onChange={e=>setLuck(Number(e.target.value))} disabled={running}>
       {luckOptions.map(n=><option key={n} value={n}>{(n/100).toLocaleString('de-DE')}× Luck</option>)}
      </select>
     </label>
     <label>DAUER
      <select value={duration} onChange={e=>setDuration(Number(e.target.value))} disabled={running}>
       {durations.map(n=><option key={n} value={n}>{n} Minute{n===1?'':'n'}</option>)}
      </select>
     </label>
    </div>
    <div className="admin-event-preview">
     <span>BEISPIEL · 75-€-KISTE</span>
     <div><del>75,00 €</del><strong>{(priceExample/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}</strong></div>
     <p>{luck===100?'Normale Drop-Chancen':(luck/100).toLocaleString('de-DE')+'× Gewicht für seltene und wertvolle Drops'}</p>
    </div>
    {error&&<div className="admin-error" role="alert">{error}</div>}
    {message&&<div className="admin-notice" role="status">{message}</div>}
    <button className="admin-primary admin-event-start" disabled={busy||running||(discount===0&&luck===100)}
     onClick={()=>void submit('startEvent')}>{busy?'WIRD VERARBEITET …':'✦ EVENT FÜR '+duration+' MINUTEN STARTEN ↗'}</button>
    <p className="admin-event-footnote">Luck erhöht relative Gewichte der seltenen und profitablen Drops. Es garantiert keinen Gewinn. Während des Events gelten neue Preise für neu erstellte Battles; bestehende offene Battles behalten ihre ursprünglich bezahlten Einsätze.</p>
   </div>
  </section>
  <section className="admin-section">
   <div className="admin-section-head"><h2>EVENT-VERLAUF</h2><span>LETZTE 15 EVENTS / STOPPS</span></div>
   {logs.length?logs.map(e=><div className="admin-event-log" key={e.id}>
    <div><strong>{e.action==='START_EVENT'?'EVENT GESTARTET':'EVENT BEENDET'}</strong><span>{e.actorUsername} · {formatTime(e.createdAt)}</span></div>
    <span>{(()=>{try{const d=JSON.parse(e.details);return e.action==='START_EVENT'?
     d.discountPercent+' % / '+(d.luckMultiplier/100).toLocaleString('de-DE')+'× / '+d.durationMinutes+' min':'Vorzeitig beendet'}catch{return '—'}})()}</span>
   </div>):<p className="admin-empty">Noch keine Events gestartet.</p>}
  </section>
 </div>;
}
