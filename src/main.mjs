import { randomBytes } from 'node:crypto';
import { createServer } from './server.mjs';
const token=randomBytes(32).toString('hex');
const port=process.env.PORT===undefined?0:Number(process.env.PORT);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be 0–65535');
const server=createServer({token});
server.listen(port,'127.0.0.1',()=>{
  console.log(`pi-track-view: http://127.0.0.1:${server.address().port}`);
  console.log('Open that address in your browser. No browser or editor window is opened automatically.');
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
