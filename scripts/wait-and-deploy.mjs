import { createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
for (const f of [".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f,"utf8").split("\n")){const m=l.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}
const chain = defineChain({id:10143,name:"Monad Testnet",nativeCurrency:{name:"MON",symbol:"MON",decimals:18},rpcUrls:{default:{http:["https://testnet-rpc.monad.xyz"]}}});
const acct = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
const pub = createPublicClient({chain,transport:http()});
console.log("Waiting for funds on", acct.address, "...");
while(true){
  try{ const b = await pub.getBalance({address:acct.address}); if(b>0n){console.log("FUNDED:",b.toString(),"wei"); break;} }catch(e){}
  await new Promise(r=>setTimeout(r,10000));
}
