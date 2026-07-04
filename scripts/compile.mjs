// Compile every contract in contracts/ with solc -> lib/contracts.json
// (a map of { ContractName: { abi, bytecode } }).
import solc from "solc";
import fs from "fs";
import path from "path";

const DIR = "contracts";
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sol"));

const sources = {};
for (const f of files) {
  sources[f] = { content: fs.readFileSync(path.join(DIR, f), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));

let hadError = false;
for (const e of out.errors || []) {
  console.log(e.formattedMessage);
  if (e.severity === "error") hadError = true;
}
if (hadError) {
  console.error("\nCompilation failed.");
  process.exit(1);
}

const artifacts = {};
for (const file of Object.keys(out.contracts)) {
  for (const name of Object.keys(out.contracts[file])) {
    const c = out.contracts[file][name];
    artifacts[name] = {
      abi: c.abi,
      bytecode: "0x" + c.evm.bytecode.object,
    };
  }
}

fs.mkdirSync("lib", { recursive: true });
fs.writeFileSync("lib/contracts.json", JSON.stringify(artifacts, null, 2));
console.log("✓ compiled:", Object.keys(artifacts).join(", "), "-> lib/contracts.json");
