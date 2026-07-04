import fs from "fs";
import { createWalletClient, createPublicClient, http, defineChain, parseEther, formatEther, keccak256, encodePacked } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { GATEWAY_ABI } from "../lib/gatewayAbi.ts";

for (const l of fs.readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");}
const chain = defineChain({id:10143,name:"Monad Testnet",nativeCurrency:{name:"MON",symbol:"MON",decimals:18},rpcUrls:{default:{http:["https://testnet-rpc.monad.xyz"]}}});
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS;
const user = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
const pub = createPublicClient({chain,transport:http()});
const w = createWalletClient({account:user,chain,transport:http()});

console.log("user:", user.address, "gateway:", GATEWAY);
// 1. deposit
let h = await w.writeContract({address:GATEWAY,abi:GATEWAY_ABI,functionName:"deposit",value:parseEther("0.02")});
await pub.waitForTransactionReceipt({hash:h});
const bal = await pub.readContract({address:GATEWAY,abi:GATEWAY_ABI,functionName:"balance",args:[user.address]});
console.log("deposited. balance:", formatEther(bal), "MON");

// 2. open session
const sk = privateKeyToAccount(generatePrivateKey());
const expiry = BigInt(Math.floor(Date.now()/1000)+3600);
h = await w.writeContract({address:GATEWAY,abi:GATEWAY_ABI,functionName:"openSession",args:[sk.address,parseEther("0.01"),expiry]});
await pub.waitForTransactionReceipt({hash:h});
console.log("session opened for", sk.address);

// 3. metered call
const nonce = `${Date.now()}`;
const message = `proofofmodel:${sk.address.toLowerCase()}:${nonce}`;
const signature = await sk.signMessage({message});
const res = await fetch("http://localhost:3000/api/gateway/chat/completions",{
  method:"POST",
  headers:{"Content-Type":"application/json","X-Session-Key":sk.address,"X-Signature":signature,"X-Nonce":nonce},
  body:JSON.stringify({model:"claude-opus-4.8",messages:[{role:"user",content:"Say hi in 4 words."}],max_tokens:60})
});
const meter = JSON.parse(res.headers.get("x-gateway-meter")||"{}");
const j = await res.json();
console.log("HTTP", res.status, "| answer:", j?.choices?.[0]?.message?.content);
console.log("meter:", meter);

// 4. read session spent
const s = await pub.readContract({address:GATEWAY,abi:GATEWAY_ABI,functionName:"sessionOf",args:[sk.address]});
console.log("session spent:", formatEther(s[2]), "/ cap", formatEther(s[1]), "MON | remaining balance:", formatEther(s[5]));

// 5. revoke, then a call should be blocked
const id = keccak256(encodePacked(["address"],[sk.address]));
h = await w.writeContract({address:GATEWAY,abi:GATEWAY_ABI,functionName:"revokeSession",args:[id]});
await pub.waitForTransactionReceipt({hash:h});
const nonce2=`${Date.now()}b`;
const sig2 = await sk.signMessage({message:`proofofmodel:${sk.address.toLowerCase()}:${nonce2}`});
const res2 = await fetch("http://localhost:3000/api/gateway/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","X-Session-Key":sk.address,"X-Signature":sig2,"X-Nonce":nonce2},body:JSON.stringify({model:"claude-opus-4.8",messages:[{role:"user",content:"hi"}]})});
console.log("after revoke -> HTTP", res2.status, "(expect 403)");
