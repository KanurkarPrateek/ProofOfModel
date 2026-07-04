// Deploy AttestationRegistry to Monad testnet using viem.
// Requires RELAYER_PRIVATE_KEY in .env.local (a funded Monad testnet key).
import fs from "fs";
import {
  createWalletClient,
  createPublicClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// --- tiny .env.local loader (no dependency) ---
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}
loadEnv();

const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
};

const pk = process.env.RELAYER_PRIVATE_KEY;
if (!pk) {
  console.error(
    "Missing RELAYER_PRIVATE_KEY in .env.local. Create a key, fund it at https://faucet.monad.xyz, then retry."
  );
  process.exit(1);
}
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : "0x" + pk);

const { abi, bytecode } = JSON.parse(
  fs.readFileSync("lib/contract.json", "utf8")
);

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const wallet = createWalletClient({ account, chain: monadTestnet, transport: http() });

const bal = await publicClient.getBalance({ address: account.address });
console.log("Deployer:", account.address);
console.log("Balance :", bal.toString(), "wei");
if (bal === 0n) {
  console.error("Deployer has 0 MON. Fund it at https://faucet.monad.xyz and retry.");
  process.exit(1);
}

console.log("Deploying AttestationRegistry...");
const hash = await wallet.deployContract({ abi, bytecode });
console.log("tx:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("✓ deployed at:", receipt.contractAddress);
console.log("  explorer:", `https://testnet.monadexplorer.com/address/${receipt.contractAddress}`);

// persist address into .env.local (NEXT_PUBLIC_ so the browser can read it)
const addrLine = `NEXT_PUBLIC_CONTRACT_ADDRESS=${receipt.contractAddress}`;
let env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
if (/NEXT_PUBLIC_CONTRACT_ADDRESS=.*/.test(env)) {
  env = env.replace(/NEXT_PUBLIC_CONTRACT_ADDRESS=.*/, addrLine);
} else {
  env += (env.endsWith("\n") || env === "" ? "" : "\n") + addrLine + "\n";
}
fs.writeFileSync(".env.local", env);
console.log("✓ wrote NEXT_PUBLIC_CONTRACT_ADDRESS to .env.local");
