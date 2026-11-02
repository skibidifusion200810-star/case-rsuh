'use client';
import {useEffect,useState} from 'react';
const phrases:[string,string][]=[
 ['BESTENLISTE','LEADERBOARD'],['KISTEN','CASES'],['INVENTAR','INVENTORY'],['STARTSEITE','HOME'],['CASE BATTLES','CASE BATTLES'],['LIVE CHAT','LIVE CHAT'],['ANMELDEN','SIGN IN'],['ABMELDEN','LOG OUT'],['REGISTRIEREN','REGISTER'],['EINLOGGEN','LOG IN'],['Benutzername','Username'],['Passwort','Password'],['DIE NÄCHSTE ÖFFNUNG.','THE NEXT UNBOXING.'],['WÄHLE DEINE KISTE.','CHOOSE YOUR CASE.'],['KISTE ANSEHEN','VIEW CASE'],['KISTE ÖFFNEN','OPEN CASE'],['KOSTENLOS','FREE'],['DEINE SAMMLUNG.','YOUR COLLECTION.'],['DIE BESTEN SPIELER.','THE TOP PLAYERS.'],['DIE ARENA WARTET.','THE ARENA AWAITS.'],['MEHR POWER.','MORE POWER.'],['Öffne Kisten, entdecke Skins und verwalte deine Gewinne.','Open cases, discover skins and manage your drops.'],['ALLE DUPLIKATE MERGEN','MERGE ALL DUPLICATES'],['SOFORT VERKAUFEN','SELL NOW'],['ALLES VERKAUFEN','SELL ALL'],['VERKAUFEN','SELL'],['ERNEUT ÖFFNEN','OPEN AGAIN'],['MÖGLICHE ITEMS / DROP-CHANCEN','POSSIBLE DROPS / ODDS'],['WAFFE / ZUSTAND','WEAPON / CONDITION'],['Gesamtpreis','Total price'],['MEHRFACHÖFFNUNG','MULTI-OPEN'],['INS INVENTAR LEGEN','KEEP IN INVENTORY'],['SCHLIESSEN / ITEMS BEHALTEN','CLOSE / KEEP ITEMS'],['SCHLIESSEN','CLOSE'],['ÖFFNEN','OPEN'],['KISTEN ENTDECKEN','EXPLORE CASES'],['ALLE KISTEN ANSEHEN','VIEW ALL CASES'],['ZUM SPIEL','PLAY NOW'],['SPIELER','PLAYERS'],['ÜBERSICHT','OVERVIEW'],['ANKÜNDIGUNGEN','ANNOUNCEMENTS'],['PROTOKOLL','AUDIT LOG'],['BELOHNUNGEN','REWARDS'],['KONTROLLE','CONTROL'],['WARTUNGSMODUS','MAINTENANCE MODE'],['GUTHABEN','BALANCE'],['GRATIS-KISTE','FREE CASE'],['BEHALTEN','KEEP'],['GEWINNE','DROPS'],['Bitte anmelden.','Please sign in.'],['WAFFE HINZUFÜGEN','ADD WEAPON'],['Keine Auszahlungen','No cash withdrawals'],['Kein Echtgeld','No real money'],['Spielgeld','Game credits'],['DEIN INVENTAR','YOUR INVENTORY'],['KISTEN, DIE AUFFALLEN.','CASES THAT STAND OUT.']
];
const translate=(text:string,lang:'de'|'en')=>{
 if(lang==='de')return text;
 let out=text;
 for(const [de,en] of phrases)if(out.includes(de))out=out.split(de).join(en);
 return out;
};
export default function LanguageSwitcher(){
 const [lang,setLang]=useState<'de'|'en'>('de');
 useEffect(()=>{if(localStorage.getItem('case-rush-language')==='en')setLang('en')},[]);
 useEffect(()=>{
  document.documentElement.lang=lang;localStorage.setItem('case-rush-language',lang);
  const originals=new WeakMap<Text,string>();
  const scan=(root:Node)=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
   for(const node of nodes){
    if(node.parentElement?.closest('[data-no-translate],script,style,textarea,code,pre'))continue;
    const original=originals.get(node)??node.textContent??'';
    originals.set(node,original);
    const next=translate(original,lang);if(node.textContent!==next)node.textContent=next;
   }
  };
  scan(document.body);
  const obs=new MutationObserver(changes=>{for(const change of changes){
   if(change.type==='characterData'){
    const node=change.target as Text;
    if(node.parentElement?.closest('[data-no-translate],script,style,textarea,code,pre'))continue;
    const original=originals.get(node);
    if(original===undefined||node.textContent!==translate(original,lang)){originals.set(node,node.textContent??'');scan(node.parentElement||document.body)}
   }else for(const node of Array.from(change.addedNodes))if(node.nodeType===1)scan(node);
  }});
  obs.observe(document.body,{subtree:true,childList:true,characterData:true});
  return()=>obs.disconnect();
 },[lang]);
 return <div className="cr-language-switch" aria-label="Language / Sprache" data-no-translate><button type="button" aria-pressed={lang==='de'} className={lang==='de'?'active':''} onClick={()=>setLang('de')}>DE</button><span>/</span><button type="button" aria-pressed={lang==='en'} className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button></div>;
}
