// ABI for AttestationRegistry — kept in sync with contracts/AttestationRegistry.sol
export const ATTESTATION_ABI = [
  {
    type: "function",
    name: "attest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "endpointUrl", type: "string" },
      { name: "claimedModel", type: "string" },
      { name: "detectedModel", type: "string" },
      { name: "verified", type: "bool" },
      { name: "confidence", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reputationByUrl",
    stateMutability: "view",
    inputs: [{ name: "endpointUrl", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEndpoint",
    stateMutability: "view",
    inputs: [{ name: "endpointUrl", type: "string" }],
    outputs: [
      { name: "verifiedCount", type: "uint64" },
      { name: "failedCount", type: "uint64" },
      { name: "total", type: "uint64" },
      { name: "lastVerdictTime", type: "uint64" },
      { name: "lastVerified", type: "bool" },
      { name: "claimedModel", type: "string" },
      { name: "detectedModel", type: "string" },
      { name: "rep", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Attested",
    inputs: [
      { name: "endpointId", type: "bytes32", indexed: true },
      { name: "verifier", type: "address", indexed: true },
      { name: "endpointUrl", type: "string", indexed: false },
      { name: "claimedModel", type: "string", indexed: false },
      { name: "detectedModel", type: "string", indexed: false },
      { name: "verified", type: "bool", indexed: false },
      { name: "confidence", type: "uint16", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
