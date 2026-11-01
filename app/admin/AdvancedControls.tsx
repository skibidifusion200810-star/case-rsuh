'use client';
import {useEffect,useState} from 'react';
export default function AdvancedControls(){
 const [data,setData]=useState<any>({});
 const [view,setView]=useState('dashboard');
 const [fields,setFields]=useState<Record<string,string>>({});
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [player,setPlayer]=useState<any>(null);
 const [catalog,setCatalog]=useState<Array<{id:string;name:string;imageUrl:string|null}>>([]);
 const field=(k:string)=>fields[k]||'';
 const set=(k:string,v:string)=>setFields(f=>({...f,[k]:v}));
 async function load(){try{const r=await fetch('/api/admin/advanced?view=summary',{cache:'no-store'});if(r.ok)setData(await r.json())}catch{}}
 useEffect(()=>{void load();void fetch('/api/admin/advanced?view=catalog').then(r=>r.json()).then(j=>setCatalog(j.items||[])).catch(()=>{});const id=setInterval(()=>void load(),15000);return()=>clearInterval(id)},[]);
 async function act(action:string,payload:Record<string,unknown>){
  if(!window.confirm('Admin-Aktion '+action+' ausführen?'))return;
  setBusy(true);setNotice('');
  try{const r=await fetch('/api/admin/advanced',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});const j=await r.json();if(!r.ok)throw Error(j.error||'Fehler');setNotice('Erfolgreich: '+action);await load()}catch(e){setNotice(e instanceof Error?e.message:'Fehler')}finally{setBusy(false)}
 }
 const input=(key:string,label:string,type='text')=><label className="adv-field">{label}<input type={type} value={field(key)} onChange={e=>set(key,e.target.value)}/></label>;
 const n=(key:string)=>Number(field(key));
 const btn=(label:string,action:string,payload:Record<string,unknown>)=><button type="button" className="admin-primary" disabled={busy} onClick={()=>void act(action,payload)}>{label}</button>;
 async function loadPlayer(){try{const r=await fetch('/api/admin/advanced?view=players&userId='+encodeURIComponent(field('userId')));const j=await r.json();if(!r.ok)throw Error(j.error);setPlayer(j)}catch(e){setNotice(e instanceof Error?e.message:'Fehler')}}
 const tabs=['dashboard','players','rewards','events','cases','control'];
 return <section className="admin-section adv-controls"><h2>ADVANCED ADMINISTRATION</h2>
  <div className="adv-tabs">{tabs.map(t=><button key={t} className={view===t?'active':''} onClick={()=>setView(t)}>{t.toUpperCase()}</button>)}</div>
  {notice&&<p role="status">{notice}</p>}
  {view==='dashboard'&&<><h3>LIVE ANALYTICS & ECONOMY</h3><div className="admin-stats">{Object.entries(data.stats||{}).map(([k,v])=><div className="admin-stat" key={k}><span>{k}</span><strong>{String(v)}</strong></div>)}</div><h3>LIVE DROPS</h3>{(data.drops||[]).map((d:any)=><div className="adv-line" key={d.id}>{d.username} · {d.itemName} · {new Date(d.createdAt).toLocaleString('de-DE')}</div>)}</>}
  {view==='players'&&<>{input('userId','SPIELER-ID')}<button className="admin-primary" onClick={()=>void loadPlayer()}>SPIELERDATEN LADEN</button>{player?.player&&<><h3>{player.player.username}</h3><p>Öffnungen: {player.stats.openings} · Battles: {player.stats.battles} · Siege: {player.stats.wins} · Gewinnrate: {player.stats.winRate}%</p><div className="adv-scroll">{player.inventory.map((i:any)=><div key={i.id} className="adv-line">{i.item.name} · {i.id}</div>)}</div>{player.warnings.map((w:any)=><div className="adv-line" key={w.id}>{w.reason}</div>)}</>}{input('amount','BETRAG IN CENT ODER XP','number')}{input('reason','VERWARNUNGSGRUND')}
   {btn('GUTHABEN SETZEN','setCoins',{userId:field('userId'),amount:n('amount')})}{btn('XP SETZEN','setXp',{userId:field('userId'),amount:n('amount')})}{btn('VERWARNEN','warn',{userId:field('userId'),reason:field('reason')})}
   {[1,24,168].map(hours=>btn(hours+' STUNDEN SPERREN','temporaryBan',{userId:field('userId'),hours}))}
   {input('inventoryId','INVENTAR-ITEM-ID')}{btn('SKIN ENTFERNEN','removeInventory',{userId:field('userId'),inventoryId:field('inventoryId')})}
   <label className="adv-field">WAFFE AUSWÄHLEN<select value={field('itemId')} onChange={e=>set('itemId',e.target.value)}><option value="">Waffe wählen</option>{catalog.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>{btn('WAFFE GEBEN','grantSkin',{userId:field('userId'),itemId:field('itemId'),count:1})}</>}
  {view==='rewards'&&<>{input('amount','COINS IN CENT','number')}{btn('GLOBAL GIVEAWAY','globalGiveaway',{amount:n('amount')})}{btn('MYSTERY DROP','mysteryDrop',{})}
   {input('code','ADMIN-CODE')}{input('maxUses','MAX. NUTZUNGEN','number')}{input('itemId','OPTIONALE WAFFEN-ID')}
   {btn('CODE ERSTELLEN','createPromo',{code:field('code'),amount:n('amount'),maxUses:n('maxUses'),itemId:field('itemId')})}
   {(data.codes||[]).map((c:any)=><div className="adv-line" key={c.id}>{c.code} ({c.uses}/{c.maxUses})</div>)}</>}
  {view==='events'&&<>{input('title','TITEL')}{input('start','START','datetime-local')}{input('end','ENDE','datetime-local')}{input('discount','RABATT %','number')}{input('luck','LUCK % (200 = 2x)','number')}
   {btn('HAPPY HOUR / EVENT PLANEN','scheduleEvent',{title:field('title'),start:field('start'),end:field('end'),discount:n('discount'),luck:n('luck')})}
   {(data.scheduled||[]).map((e:any)=><div className="adv-line" key={e.id}>{e.title} · {e.startsAt} – {e.endsAt}</div>)}</>}
  {view==='cases'&&<>{input('name','KISTENNAME')}{input('slug','SLUG')}{input('price','PREIS CENT','number')}{input('imageUrl','BILD-URL')}<label className="adv-field">SKINS AUS DEM KATALOG AUSWÄHLEN<select multiple size={10} value={field('itemIds').split(',').filter(Boolean)} onChange={e=>set('itemIds',Array.from(e.target.selectedOptions).map(o=>o.value).join(','))}>{catalog.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
   {btn('KISTE ERSTELLEN','createCase',{name:field('name'),slug:field('slug'),price:n('price'),imageUrl:field('imageUrl'),itemIds:field('itemIds').split(',').map(x=>x.trim())})}
   {input('caseId','JACKPOT-KISTEN-ID')}{input('multiplier','JACKPOT-MULTIPLIKATOR %','number')}{btn('JACKPOT SETZEN','setJackpot',{caseId:field('caseId'),multiplier:n('multiplier')})}</>}
  {view==='control'&&<>{btn('WARTUNG AKTIVIEREN','maintenance',{enabled:true})}{btn('WARTUNG DEAKTIVIEREN','maintenance',{enabled:false})}
   {input('amount','EINSTELLUNGSWERT','number')}
   {['START_COINS','CHAT_COOLDOWN_MS','GIFT_COOLDOWN_MS','MAX_OPENINGS'].map(k=>btn(k+' SETZEN','setting',{key:k,amount:n('amount')}))}
   {input('battleId','OFFENE BATTLE-ID')}{btn('BATTLE ABBRECHEN + ERSTATTEN','cancelBattle',{battleId:field('battleId')})}
   {input('offerId','TRADE-ID')}{input('reason','GRUND')}{btn('TRADE MARKIEREN','flagTrade',{offerId:field('offerId'),reason:field('reason')})}
  </>}
 </section>;
}