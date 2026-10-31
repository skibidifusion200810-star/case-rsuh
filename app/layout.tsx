import './style.css';
import GlobalSocial from './components/GlobalSocial';
import EventBanner from './components/EventBanner';
import LiveAnnouncements from './components/LiveAnnouncements';
export const metadata={title:'CASE RUSH',description:'Virtuelle Cases und Items. Keine Echtgeldwerte.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body><EventBanner/><LiveAnnouncements/>{children}<GlobalSocial/></body></html>}
