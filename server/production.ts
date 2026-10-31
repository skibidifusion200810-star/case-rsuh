import next from 'next';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
const port=Number(process.env.PORT||3000);
const app=next({dev:false,hostname:'0.0.0.0',port});
async function main(){
 await app.prepare();
 const http=createServer((req,res)=>void app.getRequestHandler()(req,res));
 const io=new Server(http,{cors:{origin:process.env.APP_ORIGIN || (process.env.RENDER_EXTERNAL_HOSTNAME ? 'https://'+process.env.RENDER_EXTERNAL_HOSTNAME : false)}});
 io.on('connection',socket=>socket.emit('notice','Case Rush online'));
 http.listen(port,'0.0.0.0',()=>console.log('CASE RUSH on '+port));
}
main().catch(e=>{console.error(e);process.exit(1)});
