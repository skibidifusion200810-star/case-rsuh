'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import './admin.css';
import AdminEventControls from './EventControls';

type Tab='overview'|'users'|'cases'|'chat'|'battles'|'audit'|'events'|'announcements';
type User={id:string;username:string;lastSeenAt:string|null;lastLoginAt:string|null;visitCount:number;coins:number;openSlots:number;isBanned:boolean;createdAt:string;_count:{inventory:number;openings:number}};
type AdminCase={id:string;slug:string;name:string;price:number;items:Array<{id:string;name:string;rarity:string;value:number;weight:number;imageUrl:string|null}>};
type Chat={id:string;body:string;createdAt:string;user:{id:string;username:string}};
type Audit={id:string;createdAt:string;actorUsername:string;action:string;targetType:string;targetId:string;details:string};
type Battle={id:string;status:string;createdAt:string;duo:boolean;againstBot:boolean;bots:number;totalCost:number;creator:string;guest:string|null;winner:string|null};
type Announcement={id:string;message:string;createdAt:string;expiresAt:string};
type Stats={users:number;cases:number;openings:number;battles:number;chat:number;totalCoins:number};
const euros=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
const number=(v:string)=>Number(v.trim().replace(/\./g,'').replace(',','.'));
const date=(v:string)=>new Date(v).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'});
function parseMoney(v:string):number|null{
 const trimmed=v.trim();
 if(!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(trimmed))return null;
 const [whole,fraction='']=trimmed.replace(',','.').split('.');
 const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(amount)&&amount>=0&&amount<=100000000?amount:null;
}
const sections:[Tab,string,string][]=[
 ['overview','ÜBERSICHT','▦'],['users','SPIELER','◈'],
 ['cases','KISTEN','⬡'],['events','EVENTS','✦'],['announcements','ANKÜNDIGUNGEN','◉'],['chat','CHAT','◉'],
 ['battles','BATTLES','⚔'],['audit','PROTOKOLL','▤']
];
export default function AdminPage(){
 const [tab,setTab]=useState<Tab>('overview');
 const [authorized,setAuthorized]=useState<boolean|null>(null);
 const [accountId,setAccountId]=useState('');
 const [configured,setConfigured]=useState(false);
 const [loginRequired,setLoginRequired]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [users,setUsers]=useState<User[]>([]);
 const [announcements,setAnnouncements]=useState<Announcement[]>([]);
 const [activityUser,setActivityUser]=useState<User|null>(null);
 const [activityLogs,setActivityLogs]=useState<Array<{id:string;activity:string;createdAt:string}>>([]);
 const [announcementText,setAnnouncementText]=useState('');
 const [announcementDuration,setAnnouncementDuration]=useState(5);
 const [announcementUnit,setAnnouncementUnit]=useState<'seconds'|'minutes'|'hours'>('seconds');
 const [cases,setCases]=useState<AdminCase[]>([]);
 const [chats,setChats]=useState<Chat[]>([]);
 const [battles,setBattles]=useState<Battle[]>([]);
 const [audits,setAudits]=useState<Audit[]>([]);
 const [stats,setStats]=useState<Stats|null>(null);
 const [selectedUser,setSelectedUser]=useState<User|null>(null);
 const [grant,setGrant]=useState('100,00');
 const [expandedCase,setExpandedCase]=useState<string|null>(null);
 const [casePrices,setCasePrices]=useState<Record<string,string>>({});
 const [weights,setWeights]=useState<Record<string,string>>({});
 const [username,setUsername]=useState('');

 async function load(view:Tab=tab,search=query){
  setLoading(true);
  try{
   const parameters=new URLSearchParams({view});
   if(view==='users'&&search)parameters.set('q',search);
   const res=await fetch('/api/admin?'+parameters,{cache:'no-store'});
   const body=await res.json();
   if(!res.ok){
    if(res.status===401){setAuthorized(false);setLoginRequired(true);return}
    if(res.status===403){
     setAuthorized(false);setLoginRequired(false);
     setConfigured(!!body.configured);setAccountId(body.accountId||'');return;
    }
    throw Error(body.error||'Verbindungsfehler');
   }
   setAuthorized(true);setLoginRequired(false);setError('');
   if(view==='overview'){setStats(body.stats);setAudits(body.actions||[])}
   if(view==='users')setUsers(body.users||[]);
   if(view==='announcements')setAnnouncements(body.announcements||[]);
   if(view==='chat')setChats(body.messages||[]);
   if(view==='cases'){
    const values:Record<string,string>={};
    const chances:Record<string,string>={};
    (body.cases as AdminCase[]).forEach(c=>{
     values[c.id]=(c.price/100).toFixed(2).replace('.',',');
     c.items.forEach(i=>{chances[i.id]=String(i.weight)});
    });
    setCasePrices(values);setWeights(chances);setCases(body.cases||[]);
   }
   if(view==='battles')setBattles(body.battles||[]);
   if(view==='audit')setAudits(body.actions||[]);
  }catch(e){setError(e instanceof Error?e.message:'Fehler beim Laden')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load(tab)},[tab]);
 useEffect(()=>{if(tab!=='users')return;const interval=setInterval(()=>{void load('users',query)},15000);return()=>clearInterval(interval)},[tab,query]);
 async function mutate(action:string,params:Record<string,unknown>,message:string,refresh:Tab=tab){
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action,...params})});
   const body=await res.json();
   if(!res.ok)throw Error(body.error||'Aktion fehlgeschlagen');
   setNotice(message);
   await load(refresh);
   window.dispatchEvent(new Event('cr-balance-changed'));
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Aktion fehlgeschlagen');return false}
  finally{setBusy(false)}
 }
 async function showActivity(u:User){setActivityUser(u);setActivityLogs([]);try{const r=await fetch('/api/admin?view=activity&userId='+encodeURIComponent(u.id),{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Aktivitäten nicht abrufbar');setActivityLogs(j.activity||[])}catch(e){setError(e instanceof Error?e.message:'Fehler')}}
 function credit(){
  if(!selectedUser)return;
  const cents=parseMoney(grant);
  if(cents===null||cents<1){setError('Gültigen Betrag zwischen 0,01 € und 1.000.000 € angeben');return}
  if(!window.confirm('Wirklich '+euros(cents)+' virtuelles Guthaben an '+selectedUser.username+' verschenken? Die Aktion wird protokolliert.'))return;
  void (async()=>{
   const ok=await mutate('grantCoins',{userId:selectedUser.id,amountCents:cents},
    euros(cents)+' wurden '+selectedUser.username+' gutgeschrieben.','users');
   if(ok)setSelectedUser(null);
  })();
 }
 function ban(u:User){
  if(!window.confirm(u.isBanned?
   'Spieler '+u.username+' wieder entsperren?':
   'Spieler '+u.username+' sperren und alle aktiven Sessions beenden?'))return;
  void mutate(u.isBanned?'unban':'ban',{userId:u.id},u.username+(u.isBanned?' entsperrt':' gesperrt'));
 }
 return <div className="admin-shell">
  <header className="admin-top">
   <Link href="/" className="admin-brand">CASE <b>RUSH.</b><span>CONTROL</span></Link>
   <div className="admin-top-right"><span className="admin-secure">● OWNER ONLY</span><Link href="/cases">ZURÜCK ZUM SPIEL ↗</Link></div>
  </header>
  {authorized===false?
   <main className="admin-setup">
    <div className="admin-setup-icon">⌁</div>
    <div className="admin-kicker">RESTRICTED ACCESS / 403</div>
    <h1>{loginRequired?'ZUERST ANMELDEN.':'ADMINZUGRIFF GESPERRT.'}</h1>
    {loginRequired?
     <><p>Du musst dich zuerst mit deinem persönlichen CASE-RUSH-Konto anmelden.</p>
      <Link className="admin-primary" href="/cases?auth=login">ZUR ANMELDUNG ↗</Link></>:
     <><p>Der Zugang ist nur für die in Render konfigurierte Konto-ID freigegeben. Ein Hotkey oder ein öffentliches Passwort erteilt keine Adminrechte.</p>
      <div className="admin-setup-steps">
       <div><span>01</span><p>Öffne Render → <strong>case-rush → Environment</strong>.</p></div>
       <div><span>02</span><p>Lege die Umgebungsvariable <code>ADMIN_USER_ID</code> an und trage die ID deines angemeldeten Kontos ein.</p></div>
       <div><span>03</span><p>Speichere und starte den neuesten Deploy. Melde dich mit diesem Konto an und öffne <code>/admin</code>.</p></div>
      </div>
      <div className="admin-identity"><span>DEINE KONTO-ID</span>
       <code>{accountId||'Bitte zuerst anmelden'}</code>
       {accountId&&<button onClick={()=>void navigator.clipboard.writeText(accountId)}>ID KOPIEREN</button>}
      </div>
      {!configured&&<p className="admin-setup-warning">Noch keine gültige ADMIN_USER_ID auf diesem Server hinterlegt.</p>}
      <button className="admin-secondary" onClick={()=>void load('overview')}>ZUGRIFF ERNEUT PRÜFEN</button>
     </>}
   </main>:
   <div className="admin-content">
    <aside className="admin-sidebar">
     <div className="admin-sidebar-label">MANAGEMENT / V1</div>
     {sections.map(([id,label,icon])=><button key={id} onClick={()=>{setTab(id);setNotice('');setError('')}}
      className={'admin-nav-item '+(tab===id?'active':'')}>
      <span>{icon}</span>{label}<b>↗</b>
     </button>)}
     <div className="admin-sidebar-end">ALLE BETRÄGE VIRTUELL<br/>KEINE ECHTGELD-AUSZAHLUNG</div>
    </aside>
    <main className="admin-main">
     <div className="admin-page-intro"><div><div className="admin-kicker">CASE RUSH / ADMINISTRATION / {tab.toUpperCase()}</div>
      <h1>{({overview:'COMMAND CENTER.',users:'SPIELER VERWALTEN.',cases:'CASE CONTROL.',events:'LIVE EVENT CONTROL.',announcements:'LIVE ANKÜNDIGUNGEN.',chat:'CHAT MODERATION.',battles:'BATTLE MONITOR.',audit:'ÄNDERUNGSPROTOKOLL.'} as Record<Tab,string>)[tab]}</h1>
      <p>Serverseitig geschützt · Alle Aktionen werden überprüft und sensible Änderungen protokolliert.</p>
     </div><button className="admin-refresh" onClick={()=>void load(tab)} disabled={busy||loading}>↻ AKTUALISIEREN</button></div>
     {notice&&<p className="admin-notice" role="status">{notice}</p>}
     {error&&<p className="admin-error" role="alert">{error}</p>}
     {loading&&<p className="admin-loading">DATEN WERDEN GELADEN …</p>}
     {tab==='overview'&&stats&&<div className="admin-dashboard">
      <div className="admin-stats">
       {([['SPIELER',stats.users],['GEÖFFNETE KISTEN',stats.openings],['BATTLES',stats.battles],['KISTEN',stats.cases],['CHAT-NACHRICHTEN',stats.chat],['GESAMTGUTHABEN',euros(stats.totalCoins)]] as [string,number|string][]).map(([key,value])=>
        <div className="admin-stat" key={key}><span>{key}</span><strong>{typeof value==='number'?value.toLocaleString('de-DE'):value}</strong></div>)}
      </div>
      <section className="admin-section"><div className="admin-section-head"><h2>LETZTE ADMINAKTIONEN</h2><button onClick={()=>setTab('audit')}>ALLE ANSEHEN ↗</button></div>
       {audits.length?audits.map(a=><div className="admin-log-line" key={a.id}>
        <span>{date(a.createdAt)}</span><strong>{a.action}</strong><span>{a.actorUsername}</span></div>):
        <p className="admin-empty">Noch keine Aktionen protokolliert.</p>}
      </section>
     </div>}
     {tab==='events'&&<AdminEventControls/>}
     {tab==='announcements'&&<section className="admin-section">
      <div className="admin-section-head"><h2>LIVE ANKÜNDIGUNG VERÖFFENTLICHEN</h2><span>GLOBAL · ALLE SPIELER</span></div>
      <p className="admin-help">Deine Nachricht erscheint automatisch auf allen geöffneten Spielseiten.</p>
      <form onSubmit={e=>{e.preventDefault();if(!announcementText.trim())return;void (async()=>{if(await mutate('publishAnnouncement',{message:announcementText.trim(),durationSeconds:announcementDuration*(announcementUnit==='hours'?3600:announcementUnit==='minutes'?60:1)},'Ankündigung veröffentlicht','announcements'))setAnnouncementText('')})()}} className="admin-announcement-form">
       <label>DEINE ANKÜNDIGUNG<textarea maxLength={500} required rows={4} placeholder="Event startet in 5 Minuten!" value={announcementText} onChange={e=>setAnnouncementText(e.target.value)}/></label>
       <label>ANZEIGEDAUER<div style={{display:'flex',gap:8}}><input aria-label="Dauer" type="number" min="1" max={announcementUnit==='hours'?24:announcementUnit==='minutes'?1440:86400} step="1" required value={announcementDuration} onChange={e=>setAnnouncementDuration(Number(e.target.value))} style={{minWidth:0,width:'50%',background:'#151a21',border:'1px solid #4c5664',color:'#fff',padding:14}}/><select aria-label="Zeiteinheit" value={announcementUnit} onChange={e=>setAnnouncementUnit(e.target.value as 'seconds'|'minutes'|'hours')}><option value="seconds">Sekunden</option><option value="minutes">Minuten</option><option value="hours">Stunden</option></select></div></label>
       <button type="submit" className="admin-primary" disabled={busy||!announcementText.trim()||!Number.isInteger(announcementDuration)||announcementDuration<1||announcementDuration*(announcementUnit==='hours'?3600:announcementUnit==='minutes'?60:1)>86400}>✦ AN ALLE SPIELER SENDEN</button>
      </form>
      <div className="admin-section-head"><h2>LETZTE ANKÜNDIGUNGEN</h2></div>
      {announcements.map(a=><div key={a.id} className="admin-announcement-row"><div><strong>{a.message}</strong><small>{date(a.createdAt)} · Ende {date(a.expiresAt)} · {new Date(a.expiresAt).getTime()>Date.now()?'LIVE':'ABGELAUFEN'}</small></div><button className="admin-small-danger" disabled={busy} onClick={()=>void mutate('removeAnnouncement',{announcementId:a.id},'Ankündigung entfernt','announcements')}>ENTFERNEN</button></div>)}
     </section>}
     {tab==='users'&&<section className="admin-section">
      <div className="admin-section-head"><h2>BENUTZERKONTEN</h2><span>GUTHABEN · SPERREN</span></div>
      <form className="admin-search" onSubmit={e=>{e.preventDefault();void load('users',query)}}>
       <input aria-label="Benutzer suchen" placeholder="Benutzernamen suchen …" value={query} onChange={e=>setQuery(e.target.value)}/>
       <button className="admin-primary">SPIELER SUCHEN ↗</button>
      </form>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SPIELER</th><th>GUTHABEN</th><th>ÖFFNUNGEN</th><th>INVENTAR</th><th>STATUS</th><th>LETZTER ZUGRIFF</th><th>LETZTER LOGIN / ANMELDUNGEN</th><th>AKTIONEN</th></tr></thead>
       <tbody>{users.map(u=><tr key={u.id}><td><strong>{u.username}</strong><small>{date(u.createdAt)}</small></td>
        <td className="admin-gold">{euros(u.coins)}</td><td>{u._count.openings}</td><td>{u._count.inventory}</td>
        <td><span className={'admin-state '+(u.isBanned?'blocked':u.lastSeenAt&&Date.now()-new Date(u.lastSeenAt).getTime()<60000?'ok':'blocked')}>{u.isBanned?'GESPERRT':u.lastSeenAt&&Date.now()-new Date(u.lastSeenAt).getTime()<60000?'● ONLINE':'○ OFFLINE'}</span></td><td>{u.lastSeenAt?date(u.lastSeenAt):'Unbekannt'}</td><td>{u.lastLoginAt?date(u.lastLoginAt):'Unbekannt'}<small>{u.visitCount} Anmeldungen</small></td>
        <td><div className="admin-row-buttons">
         <button className="admin-small" onClick={()=>void showActivity(u)}>VERLAUF</button>
         <button className="admin-small-primary" onClick={()=>{setSelectedUser(u);setGrant('100,00')}}>€ GEBEN</button>
         <button className="admin-small" disabled={busy} onClick={()=>ban(u)}>{u.isBanned?'ENTSPERREN':'SPERREN'}</button>
        </div></td></tr>)}</tbody>
      </table></div>
      {!users.length&&<p className="admin-empty">Keine Spieler gefunden.</p>}
     </section>}
     {tab==='cases'&&<section className="admin-section">
      <div className="admin-section-head"><h2>KISTEN UND DROP-CHANCEN</h2><span>ÄNDERUNGEN BLEIBEN BEIM REDEPLOY</span></div>
      <p className="admin-help">Bearbeite Preis und Itemgewichte. Ein höheres Gewicht erhöht die relative Wahrscheinlichkeit. Die Chancen werden stets als Anteil am gesamten aktiven Kisten-Gewicht berechnet.</p>
      <div className="admin-case-list">{cases.map(c=><article className="admin-case" key={c.id}>
       <div className="admin-case-header"><div><strong>{c.name}</strong><small>{c.slug} · {c.items.length} Skins</small></div>
        <form onSubmit={e=>{e.preventDefault();const v=parseMoney(casePrices[c.id]||'');
         if(v!==null)void mutate('setCasePrice',{caseId:c.id,priceCents:v},'Preis aktualisiert','cases');
         else setError('Ungültiger Kistenpreis')}} className="admin-case-price">
         <label>PREIS (€ VIRTUELL)</label><input inputMode="decimal" value={casePrices[c.id]??''}
          onChange={e=>setCasePrices(x=>({...x,[c.id]:e.target.value}))}/>
         <button disabled={busy} type="submit">SPEICHERN</button></form>
        <button className="admin-collapse" onClick={()=>setExpandedCase(expandedCase===c.id?null:c.id)}>{expandedCase===c.id?'− SCHLIESSEN':'+ DROPS'}</button>
       </div>
       {expandedCase===c.id&&<div className="admin-drop-list">
        {c.items.map(i=><div className="admin-drop-row" key={i.id}>
         {i.imageUrl?<img src={i.imageUrl} alt="" loading="lazy"/>:<span>◇</span>}
         <div className="admin-drop-name"><strong>{i.name}</strong><small>{i.rarity} · {euros(i.value)}</small></div>
         <div className="admin-drop-edit"><label>DROP-GEWICHT</label><input type="number" min={0} max={100000000}
          value={weights[i.id]??String(i.weight)} onChange={e=>setWeights(w=>({...w,[i.id]:e.target.value}))}/>
         <button disabled={busy} onClick={()=>void mutate('setDropWeight',
          {itemId:i.id,weight:Number(weights[i.id])},'Drop-Gewicht gespeichert','cases')}>SPEICHERN</button></div>
        </div>)}
       </div>}</article>)}</div>
     </section>}
     {tab==='chat'&&<section className="admin-section"><div className="admin-section-head"><h2>CHAT MODERIEREN</h2><span>LETZTE 65 NACHRICHTEN</span></div>
      {chats.map(m=><div className="admin-chat-row" key={m.id}><div><strong>{m.user.username}</strong><time>{date(m.createdAt)}</time><p>{m.body}</p></div>
       <button className="admin-small-danger" disabled={busy} onClick={()=>{
        if(window.confirm('Nachricht von '+m.user.username+' endgültig löschen?'))
         void mutate('deleteMessage',{messageId:m.id},'Nachricht gelöscht','chat')}}>LÖSCHEN</button></div>)}
      {!chats.length&&<p className="admin-empty">Keine Nachrichten vorhanden.</p>}
     </section>}
     {tab==='battles'&&<section className="admin-section"><div className="admin-section-head"><h2>CASE BATTLES</h2><span>LETZTE 45 BATTLES</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>MODUS</th><th>SPIELER</th><th>GESAMTPREIS</th><th>STATUS</th><th>DATUM</th></tr></thead>
       <tbody>{battles.map(b=><tr key={b.id}><td title={b.id}>{b.id.slice(0,8)}</td>
        <td>{b.duo?'DUO 2V2':b.againstBot?'BOT':'1V1'}{b.bots?' · '+b.bots+' BOTS':''}</td>
        <td>{b.creator} vs {b.guest||'–'}</td><td>{euros(b.totalCost)}</td>
        <td><span className={'admin-state '+(b.status==='FINISHED'?'ok':'blocked')}>{b.status}</span></td>
        <td>{date(b.createdAt)}</td></tr>)}</tbody></table></div>
     </section>}
     {tab==='audit'&&<section className="admin-section"><div className="admin-section-head"><h2>SICHERHEITSPROTOKOLL</h2><span>LETZTE 100 AKTIONEN</span></div>
      {audits.map(a=><div className="admin-audit" key={a.id}><div className="admin-audit-line"><strong>{a.action}</strong><span>{date(a.createdAt)}</span></div>
       <small>{a.actorUsername} · {a.targetType} · {a.targetId}</small>
       <pre>{a.details}</pre></div>)}
      {!audits.length&&<p className="admin-empty">Noch keine Aktionen protokolliert.</p>}
     </section>}
    </main>
   </div>}
  {activityUser&&<div className="admin-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setActivityUser(null)}}><section className="admin-dialog" role="dialog" aria-modal="true" aria-label="Spieleraktivitäten"><button className="admin-dialog-close" onClick={()=>setActivityUser(null)}>✕</button><div className="admin-kicker">SPIELER / AKTIVITÄTEN</div><h2>{activityUser.username}</h2><p>Letzter Zugriff: {activityUser.lastSeenAt?date(activityUser.lastSeenAt):'Unbekannt'}</p><p>Letzter Login: {activityUser.lastLoginAt?date(activityUser.lastLoginAt):'Unbekannt'} · {activityUser.visitCount} Anmeldungen seit Aktivierung</p><div style={{maxHeight:350,overflowY:'auto'}}>{activityLogs.map(x=><div key={x.id} className="admin-event-log"><strong>{x.activity==='REGISTRATION'?'REGISTRIERUNG':'ANMELDUNG'}</strong><span>{date(x.createdAt)}</span></div>)}{!activityLogs.length&&<p className="admin-empty">Noch kein gespeicherter Login-Verlauf.</p>}</div></section></div>}
  {selectedUser&&<div className="admin-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedUser(null)}}>
    <section className="admin-dialog" role="dialog" aria-modal="true" aria-label="Virtuelles Guthaben vergeben">
     <button className="admin-dialog-close" onClick={()=>setSelectedUser(null)}>✕</button>
     <div className="admin-kicker">ADMIN / VIRTUELLE GUTSCHRIFT</div><h2>GELD <em>GEBEN.</em></h2>
     <p>Empfänger <strong>{selectedUser.username}</strong> · Aktuell {euros(selectedUser.coins)}</p>
     <label htmlFor="admin-credit-amount">BETRAG IN VIRTUELLEN EURO</label>
     <input id="admin-credit-amount" autoFocus inputMode="decimal" value={grant}
      onChange={e=>setGrant(e.target.value)} placeholder="100,00"/>
     <p className="admin-caution">Das Guthaben wird zusätzlich gutgeschrieben. Die Aktion ist sofort wirksam und wird mit deiner Konto-ID protokolliert. Kein Echtgeld.</p>
     {error&&<p className="admin-error">{error}</p>}
     <button className="admin-primary admin-dialog-submit" disabled={busy} onClick={credit}>{busy?'WIRD GUTGESCHRIEBEN …':'GUTHABEN GUTSCHREIBEN ↗'}</button>
    </section>
   </div>}
 </div>;
}
