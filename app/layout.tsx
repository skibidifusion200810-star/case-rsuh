import './style.css';
import GlobalSocial from './components/GlobalSocial';
export const metadata={title:'CASE RUSH',description:'Virtuelle Cases und Items. Keine Echtgeldwerte.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body>{children}<GlobalSocial/></body></html>}
