// ABI for PrepaidGateway — kept in sync with contracts/PrepaidGateway.sol
export const GATEWAY_ABI = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "openSession",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sessionKey", type: "address" },
      { name: "cap", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeSession",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "debit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "model", type: "string" },
      { name: "tokens", type: "uint32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "sessionId",
    stateMutability: "pure",
    inputs: [{ name: "sessionKey", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "balance",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "sessionOf",
    stateMutability: "view",
    inputs: [{ name: "sessionKey", type: "address" }],
    outputs: [
      { name: "user", type: "address" },
      { name: "cap", type: "uint256" },
      { name: "spent", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "revoked", type: "bool" },
      { name: "userBalance", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Debited",
    inputs: [
      { name: "sessionId", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "model", type: "string", indexed: false },
      { name: "tokens", type: "uint32", indexed: false },
    ],
  },
] as const;

// Price per token in wei (0.00000005 MON/token → ~visible but tiny debits).
export const WEI_PER_TOKEN = 50_000_000_000n; // 5e10
