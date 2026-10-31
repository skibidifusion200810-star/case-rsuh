import {levelProgress} from '@/lib/levels';
type Props={username:string;xp?:number;isAdmin?:boolean;compact?:boolean};
export default function PlayerIdentity({username,xp=0,isAdmin=false,compact=false}:Props){
 const progress=levelProgress(xp);
 return <span className={'cr-player-identity'+(compact?' compact':'')}>
  <span className="cr-player-name">{username}</span>
  {isAdmin&&<span className="cr-admin-badge" aria-label="Administrator">ADMIN</span>}
  <span className="cr-level-pill" title={'Level '+progress.level+' · '+progress.xp.toLocaleString('de-DE')+' XP'}>
   LVL {progress.level}</span>
 </span>;
}
export function XPProgress({xp=0}:{xp:number}){
 const progress=levelProgress(xp);
 return <div className="cr-xp-track" aria-label={'Level '+progress.level+', '+progress.percent+' Prozent bis Level '+(progress.level+1)}>
  <div className="cr-xp-copy"><span>LEVEL {progress.level} {progress.level===100?'· MAX':'· FORTSCHRITT'}</span>
   <span>{progress.level===100?'MAX LEVEL':progress.currentXp.toLocaleString('de-DE')+' / '+progress.requiredXp.toLocaleString('de-DE')+' XP'}</span></div>
  <div className="cr-xp-bar"><div style={{width:progress.percent+'%'}}/></div>
 </div>;
}
