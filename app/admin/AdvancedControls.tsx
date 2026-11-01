'use client';
import {useEffect,useMemo,useState} from 'react';
type Skin={id:string;name:string;rarity:string;value:number;imageUrl:string|null;caseId:string};
type Player={id:string;username:string;coins:number;xp:number;isBanned:boolean};
type UserDetail={player:Player|null;inventory:{id:string;item:{name:string;imageUrl:string|null;rarity:string}}[];warnings:{id:string;reason:string;createdAt:string}[];stats:{openings:number;battles:number;wins:number;winRate:number;paidBattleCaseTotal:number}};
type Summary={stats?:Record<string,number>;hourly?:{hour:string;openings:number;battles:number}[];drops?:{id:string;username:string;itemName:string;value:number;imageUrl:string|null;createdAt:string}[];scheduled?:{id:string;title:string;startsAt:string;endsAt:string;discountPercent:number;luckMultiplier:number}[];codes?:{id:string;code:string;uses:number;maxUses:number;coinAmount:number}[];maintenance?:{enabled:boolean};settings?:{key:string;value:string}[];tradeFlags?:{id:string;offerId:string;reason:string}[];jackpots?:{caseId:string;bonusMultiplier:number;endsAt:string}[]};
const money=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
const date=(s:string)=>new Date(s).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});
const tabs=[['dashboard','ÜBERSICHT'],['players','SPIELER'],['rewards','BELOHNUNGEN'],['events','EVENTS'],['cases','KISTEN'],['control','KONTROLLE']] as const;
export default function AdvancedControls(){
 const [tab,setTab]=useState<(typeof tabs)[number][0]>('dashboard');
 const [summary,setSummary]=useState<Summary>({});
 const [catalog,setCatalog]=useState<Skin[]>([]);
 const [players,setPlayers]=useState<Player[]>([]);
 const [cases,setCases]=useState<{id:string;name:string}[]>([]);
 const [battles,setBattles]=useState<{id:string;status:string;creator:string;guest:string|null}[]>([]);
 const [trades,setTrades]=useState<{id:string;status:string;sender:{username:string};recipient:{username:string}}[]>([]);
 const [selectedPlayer,setSelectedPlayer]=useState('');
 const [details,setDetails]=useState<UserDetail|null>(null);
 const [fields,setFields]=useState<Record<string,string>>({amount:'50000',maxUses:'100',discount:'10',luck:'200',multiplier:'200',count:'1',casePrice:'1000'}); 
 const [search,setSearch]=useState('');
 const [selectedSkins,setSelectedSkins]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const field=(k:string)=>fields[k]||'';
 const set=(k:string,value:string)=>setFields(old=>({...old,[k]:value}));
 const num=(k:string)=>Number(field(k));
 async function get(view:string){const r=await fetch('/api/admin/advanced?view='+view,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Serverfehler');return j}
 async function refresh(){try{setSummary(await get('summary'))}catch(e){setError(e instanceof Error?e.message:'Serverfehler')}}
 async function loadDetails(id:string){if(!id){setDetails(null);return}try{const r=await fetch('/api/admin/advanced?view=players&userId='+encodeURIComponent(id),{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Spielerdaten fehlen');setDetails(j)}catch(e){setError(e instanceof Error?e.message:'Spielerfehler')}}
 useEffect(()=>{void refresh();void get('catalog').then(j=>setCatalog(j.items||[])).catch(()=>{});void get('cases').then(j=>setCases(j.cases||[])).catch(()=>{});void get('trades').then(j=>setTrades(j.offers||[])).catch(()=>{});void fetch('/api/admin?view=users',{cache:'no-store'}).then(r=>r.json()).then(j=>setPlayers(j.users||[])).catch(()=>{});void fetch('/api/admin?view=battles',{cache:'no-store'}).then(r=>r.json()).then(j=>setBattles(j.battles||[])).catch(()=>{});const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[]);
 const matches=useMemo(()=>catalog.filter(x=>x.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0,200),[catalog,search]);
 async function run(action:string,params:Record<string,unknown>,danger=false){
  if(danger&&!window.confirm('Diese Aktion wirklich ausführen? Sie wird protokolliert.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/admin/advanced',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...params})});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Aktion fehlgeschlagen');
   setNotice(action==='globalGiveaway'?'Giveaway an '+j.count+' Spieler verteilt.':'Aktion erfolgreich: '+action);
   await refresh();if(selectedPlayer)await loadDetails(selectedPlayer);
   window.dispatchEvent(new Event('cr-balance-changed'));
  }catch(e){setError(e instanceof Error?e.message:'Unbekannter Fehler')}finally{setBusy(false)}
 }
 const action=(name:string,id:string,params:Record<string,unknown>,danger=false)=><button type="button" className={'adv-action '+(danger?'danger':'')} disabled={busy} onClick={()=>void run(id,params,danger)}>{name}</button>;
 const input=(key:string,label:string,type='text')=><label className="adv-field"><span>{label}</span><input type={type} value={field(key)} onChange={e=>set(key,e.target.value)}/></label>;
 const block=(title:string,body:React.ReactNode,desc?:string)=><section className="adv-panel"><div className="adv-panel-head"><h3>{title}</h3>{desc&&<small>{desc}</small>}</div>{body}</section>;
 const skinPicker=(multiple=false)=><><label className="adv-field"><span>WAFFE SUCHEN</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="AWP, AK-47, Karambit …"/></label><div className="adv-skin-grid">{matches.map(s=><button type="button" key={s.id} className={'adv-skin '+(selectedSkins.includes(s.id)?'selected':'')} onClick={()=>setSelectedSkins(old=>multiple?(old.includes(s.id)?old.filter(x=>x!==s.id):[...old,s.id]):[s.id])}>{s.imageUrl&&<img src={s.imageUrl} alt={s.name} loading="lazy" referrerPolicy="no-referrer"/>}<strong>{s.name}</strong><small>{s.rarity} · {money(s.value)}</small></button>)}</div></>;
 return <div className="adv-shell">
  <div className="adv-hero"><div><span className="adv-eyebrow">CASE RUSH / OWNER OPERATIONS</span><h2>COMMAND <em>CENTER.</em></h2><p>Spieler, Drops, Economy und Live-Events – direkt verwalten.</p></div><button className="adv-refresh" onClick={()=>void refresh()} disabled={busy}>↻ LIVE DATEN AKTUALISIEREN</button></div>
  <nav className="adv-tabs">{tabs.map(([id,label])=><button key={id} type="button" className={tab===id?'active':''} onClick={()=>{setTab(id);setError('');setNotice('')}}>{label}</button>)}</nav>
  {error&&<p className="adv-message error" role="alert">{error}</p>}{notice&&<p className="adv-message success" role="status">{notice}</p>}
  {tab==='dashboard'&&<><div className="adv-metrics">{Object.entries(summary.stats||{}).map(([key,value])=><div className="adv-metric" key={key}><small>{({users:'SPIELER',online:'JETZT ONLINE',signups:'NEU HEUTE',openings:'ÖFFNUNGEN / 24H',battles:'BATTLES / 24H',coins:'COINS IM UMLAUF',inventoryValue:'INVENTARWERT'} as Record<string,string>)[key]||key.toUpperCase()}</small><strong>{key==='coins'||key==='inventoryValue'?money(value):value.toLocaleString('de-DE')}</strong></div>)}</div>
  {block('AKTIVITÄT DER LETZTEN 24 STUNDEN',<div className="adv-graph">{(summary.hourly||[]).map((h,i)=><div key={i} title={h.hour+' – '+h.openings+' Öffnungen, '+h.battles+' Battles'}><span style={{height:Math.max(3,Math.min(150,h.openings*4))}}/><small>{i%4===0?h.hour:''}</small></div>)}</div>,'Live-Statistik')}
  {block('NEUESTE DROPS',<div className="adv-feed">{(summary.drops||[]).map(d=><div className="adv-feed-row" key={d.id}>{d.imageUrl&&<img src={d.imageUrl} alt="" loading="lazy"/>}<div><strong>{d.username}</strong><span>{d.itemName}</span></div><b>{money(d.value)}</b><small>{date(d.createdAt)}</small></div>)}</div>,'Alle Kistenöffnungen')}</>}
  {tab==='players'&&<>{block('SPIELER AUSWÄHLEN',<><label className="adv-field"><span>BENUTZERNAME SUCHEN</span><input value={field('playerSearch')} onChange={e=>set('playerSearch',e.target.value)} placeholder="Spielername"/></label><div className="adv-player-list">{players.filter(p=>p.username.toLowerCase().includes(field('playerSearch').toLowerCase())).map(p=><button key={p.id} className={selectedPlayer===p.id?'selected':''} onClick={()=>{setSelectedPlayer(p.id);void loadDetails(p.id)}}>{p.username}<small>{money(p.coins)}</small></button>)}</div></>)}
  {details?.player&&<>{block('SPIELERPROFIL · '+details.player.username,<><div className="adv-metrics"><div className="adv-metric"><small>GUTHABEN</small><strong>{money(details.player.coins)}</strong></div><div className="adv-metric"><small>XP</small><strong>{details.player.xp}</strong></div><div className="adv-metric"><small>ÖFFNUNGEN</small><strong>{details.stats.openings}</strong></div><div className="adv-metric"><small>SIEGRATE</small><strong>{details.stats.winRate}%</strong></div></div>{input('amount','BETRAG IN VIRTUELLEN CENTS / XP','number')}{input('reason','VERWARNUNGSGRUND')}<div className="adv-button-row">{action('GUTHABEN SETZEN','setCoins',{userId:selectedPlayer,amount:num('amount')},true)}{action('XP SETZEN','setXp',{userId:selectedPlayer,amount:num('amount')},true)}{action('VERWARNEN','warn',{userId:selectedPlayer,reason:field('reason')})}{[1,24,168].map(h=>action(h+'H SPERREN','temporaryBan',{userId:selectedPlayer,hours:h},true))}</div>{details.warnings.map(w=><p key={w.id} className="adv-muted">{date(w.createdAt)} · {w.reason}</p>)}</>)}
  {block('INVENTAR BEARBEITEN',<><div className="adv-feed">{details.inventory.map(i=><div key={i.id} className="adv-feed-row">{i.item.imageUrl&&<img src={i.item.imageUrl} alt=""/>}<div><strong>{i.item.name}</strong><span>{i.item.rarity}</span></div>{action('ENTFERNEN','removeInventory',{userId:selectedPlayer,inventoryId:i.id},true)}</div>)}</div>{skinPicker()}{input('count','ANZAHL (1–10)','number')}{action('AUSGEWÄHLTE WAFFE GEBEN','grantSkin',{userId:selectedPlayer,itemId:selectedSkins[0],count:num('count')||1})}</>)}</>}
  </>}
  {tab==='rewards'&&<>{block('GIVEAWAY & MYSTERY DROP',<>{input('amount','VIRTUELLE CENTS','number')}<div className="adv-button-row">{action('COINS AN AKTIVE SPIELER','globalGiveaway',{amount:num('amount')},true)}{action('ZUFÄLLIGEN SKIN VERLOSEN','mysteryDrop',{},true)}</div></>)}
   {block('PROMO-CODE ERSTELLEN',<>{input('code','EINLÖSECODE')}{input('maxUses','MAXIMALE NUTZUNGEN','number')}{skinPicker()}{action('CODE ERSTELLEN','createPromo',{code:field('code'),amount:num('amount'),maxUses:num('maxUses'),itemId:selectedSkins[0]||null})}<div className="adv-feed">{(summary.codes||[]).map(c=><div className="adv-feed-row" key={c.id}><strong>{c.code}</strong><span>{c.uses}/{c.maxUses} Einlösungen</span><b>{money(c.coinAmount)}</b></div>)}</div></>)}</>}
  {tab==='events'&&<>{block('HAPPY HOUR / EVENT PLANEN',<>{input('title','EVENTNAME')}{input('start','STARTZEIT','datetime-local')}{input('end','ENDZEIT','datetime-local')}{input('discount','RABATT IN %','number')}{input('luck','LUCK IN % (200 = 2×)','number')}{action('EVENT PLANEN','scheduleEvent',{title:field('title')||'Happy Hour',start:field('start'),end:field('end'),discount:num('discount'),luck:num('luck')})}</>)}
   {block('EVENT-KALENDER',<div className="adv-feed">{(summary.scheduled||[]).map(e=><div className="adv-feed-row" key={e.id}><div><strong>{e.title}</strong><span>{date(e.startsAt)} – {date(e.endsAt)}</span></div><b>{e.discountPercent}% / {e.luckMultiplier/100}×</b></div>)}</div>)}</>}
  {tab==='cases'&&<>{block('NEUE KISTE',<>{input('caseName','NAME')}{input('caseSlug','SLUG')}{input('casePrice','PREIS IN CENT','number')}{input('imageUrl','KISTENBILD-URL')}{skinPicker(true)}<p className="adv-muted">{selectedSkins.length} Waffen für den Drop-Pool ausgewählt.</p>{action('KISTE ERSTELLEN','createCase',{name:field('caseName'),slug:field('caseSlug'),price:num('casePrice'),imageUrl:field('imageUrl'),itemIds:selectedSkins},true)}</>)}
   {block('CASE JACKPOT',<><label className="adv-field"><span>KISTE</span><select value={field('caseId')} onChange={e=>set('caseId',e.target.value)}><option value="">Kiste auswählen</option>{cases.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{input('multiplier','BONUS IN %','number')}{action('JACKPOT FÜR EINE STUNDE','setJackpot',{caseId:field('caseId'),multiplier:num('multiplier')})}</>)}</>}
  {tab==='control'&&<>{block('WARTUNGSMODUS',<><p className="adv-muted">Status: {summary.maintenance?.enabled?'AKTIV':'DEAKTIVIERT'}</p><div className="adv-button-row">{action('WARTUNG EINSCHALTEN','maintenance',{enabled:true},true)}{action('WARTUNG AUSSCHALTEN','maintenance',{enabled:false})}</div></>)}
  {block('GLOBALE EINSTELLUNGEN',<>{input('settingAmount','NEUER WERT','number')}<div className="adv-button-row">{['START_COINS','CHAT_COOLDOWN_MS','GIFT_COOLDOWN_MS','MAX_OPENINGS'].map(key=>action(key+' SETZEN','setting',{key,amount:num('settingAmount')},true))}</div></>)}
  {block('OFFENE BATTLES · ERSTATTUNG',<div className="adv-feed">{battles.filter(b=>b.status==='WAITING').map(b=><div className="adv-feed-row" key={b.id}><div><strong>{b.creator} vs. {b.guest||'OFFEN'}</strong><span>{b.id.slice(0,8)}</span></div>{action('ABBRECHEN + ERSTATTEN','cancelBattle',{battleId:b.id},true)}</div>)}</div>)}
  {block('TRADING-ÜBERWACHUNG',<><div className="adv-feed">{trades.slice(0,35).map(t=><div key={t.id} className="adv-feed-row"><div><strong>{t.sender.username} ↔ {t.recipient.username}</strong><span>{t.status}</span></div><button className="adv-action" onClick={()=>{set('offerId',t.id);set('reason','Auffällige Handelsaktivität')}}>AUSWÄHLEN</button></div>)}</div>{input('reason','GRUND')}{action('TRADE MARKIEREN','flagTrade',{offerId:field('offerId'),reason:field('reason')})}</>)}</>}
 </div>;
}
