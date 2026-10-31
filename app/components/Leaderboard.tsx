'use client';

import {useEffect,useState} from 'react';
import type {LeaderboardCategory,LeaderboardEntry,LeaderboardResult} from '@/lib/leaderboard';

const euros=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
const number=(v:number)=>new Intl.NumberFormat('de-DE').format(v);
const labels:Record<LeaderboardCategory,string>={
 balance:'MEISTES GUTHABEN',
 inventory:'WERTVOLLSTES INVENTAR',
 openings:'MEISTE KISTENÖFFNUNGEN'
};
const description:Record<LeaderboardCategory,string>={
 balance:'Wer hat das höchste virtuelle Guthaben?',
 inventory:'Wert aller unverkauften, verkaufbaren Items. Gratis-Sammlerstücke zählen nicht.',
 openings:'Alle erfolgreich geöffneten Kisten, einschließlich kostenloser Öffnungen.'
};
const score=(u:LeaderboardEntry,category:LeaderboardCategory)=>
 category==='balance'?euros(u.balanceCents):category==='inventory'?euros(u.inventoryCents):number(u.totalOpenings)+' Kisten';

export default function Leaderboard(){
 const [category,setCategory]=useState<LeaderboardCategory>('balance');
 const [data,setData]=useState<LeaderboardResult|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const response=await fetch('/api/leaderboard',{cache:'no-store'});
    const json=await response.json();
    if(!response.ok)throw new Error(json.error||'Bestenliste nicht erreichbar');
    if(active){setData(json as LeaderboardResult);setError('');setLoading(false)}
   }catch(e){if(active){setError(e instanceof Error?e.message:'Serverfehler');setLoading(false)}}
  };
  void load();
  const id=window.setInterval(()=>void load(),30000);
  return()=>{active=false;window.clearInterval(id)};
 },[version]);
 const users=data?.rankings[category]??[];
 const podium=users.slice(0,3);
 return <section className="leaders" aria-label="Globale Bestenliste">
  <div className="eyebrow">03 / GLOBAL LEADERBOARD</div>
  <div className="leaders-heading">
   <div><h2>HALL OF <em>FAME.</em></h2><p>Die besten Spieler von CASE RUSH – direkt aus der Datenbank.</p></div>
   <button className="leaders-refresh" onClick={()=>setVersion(v=>v+1)} aria-label="Bestenliste aktualisieren">↻ AKTUALISIEREN</button>
  </div>
  <div className="leaders-tabs" role="tablist" aria-label="Rangliste auswählen">
   {(['balance','inventory','openings'] as const).map(key=>
    <button key={key} role="tab" aria-selected={category===key}
      className={category===key?'selected':''} onClick={()=>setCategory(key)}>
     {key==='balance'?'◈ ':key==='inventory'?'◆ ':'▰ '}{labels[key]}
    </button>)}
  </div>
  <p className="leaders-description">{description[category]}</p>
  {error&&<div className="error" role="alert">{error}</div>}
  {loading&&!data?<div className="leaders-empty">Bestenliste wird geladen …</div>:
   users.length===0?<div className="leaders-empty">Noch keine registrierten Spieler vorhanden.</div>:
   <>
    <div className="leaders-podium" aria-label="Top drei">
     {podium.map(u=><div className={'leader-hero place-'+u.rank} key={u.username}>
      <div className="leader-medal">{u.rank===1?'★':u.rank===2?'◆':'●'}</div>
      <div className="leader-position">PLATZ {String(u.rank).padStart(2,'0')}</div>
      <div className="leader-avatar" aria-hidden="true">{u.username[0]?.toUpperCase()}</div>
      <strong title={u.username}>{u.username}</strong>
      <div className="leader-score">{score(u,category)}</div>
     </div>)}
    </div>
    <div className="leaders-table-wrap">
     <table className="leaders-table">
      <thead><tr>
       <th>RANG</th><th>SPIELER</th><th className={category==='balance'?'focus':''}>GUTHABEN</th>
       <th className={category==='inventory'?'focus':''}>INVENTARWERT</th>
       <th className={category==='openings'?'focus':''}>KISTEN GEÖFFNET</th>
      </tr></thead>
      <tbody>{users.map(u=><tr key={u.username}>
       <td><span className={'leaders-place leaders-place-'+u.rank}>#{String(u.rank).padStart(2,'0')}</span></td>
       <td className="leaders-user"><span className="leader-small-avatar">{u.username[0]?.toUpperCase()}</span><strong>{u.username}</strong></td>
       <td className={'leaders-num '+(category==='balance'?'focus':'')}>{euros(u.balanceCents)}</td>
       <td className={'leaders-num '+(category==='inventory'?'focus':'')}>{euros(u.inventoryCents)}<small>{number(u.inventoryItems)} Items</small></td>
       <td className={'leaders-num '+(category==='openings'?'focus':'')}>{number(u.totalOpenings)}<small>{number(u.paidOpenings)} bezahlt · {number(u.freeOpenings)} gratis</small></td>
      </tr>)}</tbody>
     </table>
    </div>
    <p className="leaders-meta">TOP {users.length} · Automatische Aktualisierung alle 30 Sekunden{data?.updatedAt?' · Stand: '+new Date(data.updatedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):''}</p>
   </>
  }
  <p className="leaders-footnote">Sämtliche €-Beträge sind ausschließlich virtuelle Spielwerte. Gratis-Kisten-Gewinne sind nicht verkaufbar und erhöhen deshalb den Inventarwert nicht. Gratis-Kisten zählen bei den Öffnungen mit.</p>
 </section>
}
