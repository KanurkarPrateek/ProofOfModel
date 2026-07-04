// Compile contracts/AttestationRegistry.sol with solc -> lib/contract.json
import solc from "solc";
import fs from "fs";

const SRC = "contracts/AttestationRegistry.sol";
const source = fs.readFileSync(SRC, "utf8");

const input = {
  language: "Solidity",
  sources: { "AttestationRegistry.sol": { content: source } },
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

const c = out.contracts["AttestationRegistry.sol"]["AttestationRegistry"];
fs.mkdirSync("lib", { recursive: true });
fs.writeFileSync(
  "lib/contract.json",
  JSON.stringify(
    { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object },
    null,
    2
  )
);
console.log("✓ compiled -> lib/contract.json");
