import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const pk = generatePrivateKey();
const acct = privateKeyToAccount(pk);
const nonce = "1";
const message = `proofofmodel:${acct.address.toLowerCase()}:${nonce}`;
const signature = await acct.signMessage({ message });

const res = await fetch("http://localhost:3000/api/gateway/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Session-Key": acct.address,
    "X-Signature": signature,
    "X-Nonce": nonce,
  },
  body: JSON.stringify({
    model: "claude-opus-4.8",
    messages: [{ role: "user", content: "Say hello in 3 words." }],
    max_tokens: 50,
  }),
});
console.log("HTTP", res.status);
console.log("meter:", res.headers.get("x-gateway-meter"));
const j = await res.json();
console.log("answer:", j?.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0,200));

// replay same nonce -> should 401
const res2 = await fetch("http://localhost:3000/api/gateway/chat/completions", {
  method: "POST",
  headers: { "Content-Type":"application/json","X-Session-Key":acct.address,"X-Signature":signature,"X-Nonce":nonce },
  body: JSON.stringify({ model:"claude-opus-4.8", messages:[{role:"user",content:"hi"}] }),
});
console.log("replay HTTP", res2.status, "(expect 401)");

// bad signature -> should 401
const res3 = await fetch("http://localhost:3000/api/gateway/chat/completions", {
  method: "POST",
  headers: { "Content-Type":"application/json","X-Session-Key":acct.address,"X-Signature":"0xdeadbeef","X-Nonce":"2" },
  body: JSON.stringify({ model:"claude-opus-4.8", messages:[{role:"user",content:"hi"}] }),
});
console.log("badsig HTTP", res3.status, "(expect 401)");
