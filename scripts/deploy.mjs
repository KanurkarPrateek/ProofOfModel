// Deploy AttestationRegistry + PrepaidGateway to Monad testnet using viem.
// Requires RELAYER_PRIVATE_KEY in .env.local (a funded Monad testnet key).
import fs from "fs";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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
  console.error("Missing RELAYER_PRIVATE_KEY in .env.local. Fund a key at https://faucet.monad.xyz.");
  process.exit(1);
}
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : "0x" + pk);
const artifacts = JSON.parse(fs.readFileSync("lib/contracts.json", "utf8"));

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const wallet = createWalletClient({ account, chain: monadTestnet, transport: http() });

const bal = await publicClient.getBalance({ address: account.address });
console.log("Deployer:", account.address, "| balance:", bal.toString(), "wei");
if (bal === 0n) {
  console.error("Deployer has 0 MON. Fund at https://faucet.monad.xyz.");
  process.exit(1);
}

async function deploy(name) {
  const { abi, bytecode } = artifacts[name];
  console.log(`Deploying ${name}...`);
  const hash = await wallet.deployContract({ abi, bytecode });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ ${name} @ ${receipt.contractAddress}`);
  console.log(`  https://testnet.monadexplorer.com/address/${receipt.contractAddress}`);
  return receipt.contractAddress;
}

const attestation = await deploy("AttestationRegistry");
const gateway = await deploy("PrepaidGateway");

// persist addresses into .env.local (+ a JSON for the app)
function setEnv(env, key, val) {
  const line = `${key}=${val}`;
  return new RegExp(`${key}=.*`).test(env)
    ? env.replace(new RegExp(`${key}=.*`), line)
    : env + (env.endsWith("\n") || env === "" ? "" : "\n") + line + "\n";
}
let env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
env = setEnv(env, "NEXT_PUBLIC_CONTRACT_ADDRESS", attestation);
env = setEnv(env, "NEXT_PUBLIC_GATEWAY_ADDRESS", gateway);
fs.writeFileSync(".env.local", env);

fs.writeFileSync(
  "lib/deployment.json",
  JSON.stringify({ AttestationRegistry: attestation, PrepaidGateway: gateway }, null, 2)
);
console.log("✓ wrote addresses to .env.local + lib/deployment.json");
