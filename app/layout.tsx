import './style.css';
import GlobalSocial from './components/GlobalSocial';
import EventBanner from './components/EventBanner';
import LanguageSwitcher from './components/LanguageSwitcher';
import LiveAnnouncements from './components/LiveAnnouncements';
export const metadata={title:'CASE RUSH',description:'CS2-inspirierte Kisten, Skins und Case Battles. Spielgeld, keine Echtgeld-Auszahlungen.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body><LanguageSwitcher/><EventBanner/><LiveAnnouncements/>{children}<GlobalSocial/></body></html>}
