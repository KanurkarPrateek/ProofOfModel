import { createPublicClient, http, defineChain, formatEther } from "viem";
import fs from "fs";
for (const l of fs.readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}
const chain = defineChain({id:10143,name:"Monad",nativeCurrency:{name:"MON",symbol:"MON",decimals:18},rpcUrls:{default:{http:["https://testnet-rpc.monad.xyz"]}}});
const pub = createPublicClient({chain,transport:http()});
const abi = JSON.parse(fs.readFileSync("lib/contracts.json","utf8")).PrepaidGateway.abi;
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS;
const sk = "0xA22357626a83f44325C3c89586EC6CDA61aE4F0B";
const s = await pub.readContract({address:GATEWAY,abi,functionName:"sessionOf",args:[sk]});
console.log("user         :", s[0]);
console.log("cap          :", formatEther(s[1]), "MON");
console.log("spent        :", formatEther(s[2]), "MON");
console.log("expiry       :", new Date(Number(s[3])*1000).toISOString());
console.log("revoked      :", s[4]);
console.log("USER BALANCE :", formatEther(s[5]), "MON   <-- must be > 0 to serve");
if (s[0] && s[0] !== "0x0000000000000000000000000000000000000000") {
  const bal = await pub.readContract({address:GATEWAY,abi,functionName:"balance",args:[s[0]]});
  console.log("balance(user):", formatEther(bal), "MON");
}
