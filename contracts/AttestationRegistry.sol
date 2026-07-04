// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProofOfModel — AttestationRegistry
/// @notice On-chain trust layer for the Agent Economy. Verifiers probe an LLM
///         endpoint, decide whether it really serves the model it claims, and
///         record a tamper-proof verdict here. Agents/buyers read an endpoint's
///         reputation before paying — cheating proxies get a permanent red flag.
contract AttestationRegistry {
    struct Endpoint {
        uint64  verifiedCount;      // # of "authentic" verdicts
        uint64  failedCount;        // # of "fake / substituted" verdicts
        uint64  totalAttestations;
        uint64  lastVerdictTime;
        bool    lastVerified;
        string  lastClaimedModel;   // what the endpoint claims to serve
        string  lastDetectedModel;  // what the verifier fingerprinted
    }

    address public owner;
    mapping(address => bool)  public verifiers;   // whitelisted oracle nodes
    mapping(bytes32 => Endpoint) public endpoints; // id = keccak256(url)

    event Attested(
        bytes32 indexed endpointId,
        address indexed verifier,
        string  endpointUrl,
        string  claimedModel,
        string  detectedModel,
        bool    verified,
        uint16  confidence,        // 0-100
        uint256 timestamp
    );
    event VerifierAdded(address indexed verifier);

    constructor() {
        owner = msg.sender;
        verifiers[msg.sender] = true;
        emit VerifierAdded(msg.sender);
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "not a verifier");
        _;
    }

    function addVerifier(address v) external {
        require(msg.sender == owner, "only owner");
        verifiers[v] = true;
        emit VerifierAdded(v);
    }

    /// @notice Record a verification verdict for an endpoint.
    function attest(
        string calldata endpointUrl,
        string calldata claimedModel,
        string calldata detectedModel,
        bool verified,
        uint16 confidence
    ) external onlyVerifier {
        require(confidence <= 100, "confidence > 100");
        bytes32 id = keccak256(bytes(endpointUrl));
        Endpoint storage e = endpoints[id];

        e.totalAttestations += 1;
        if (verified) {
            e.verifiedCount += 1;
        } else {
            e.failedCount += 1;
        }
        e.lastVerified      = verified;
        e.lastClaimedModel  = claimedModel;
        e.lastDetectedModel = detectedModel;
        e.lastVerdictTime   = uint64(block.timestamp);

        emit Attested(
            id, msg.sender, endpointUrl, claimedModel,
            detectedModel, verified, confidence, block.timestamp
        );
    }

    /// @notice Reputation score 0-100 = share of authentic verdicts.
    function reputation(bytes32 id) public view returns (uint256) {
        Endpoint memory e = endpoints[id];
        if (e.totalAttestations == 0) return 0;
        return (uint256(e.verifiedCount) * 100) / e.totalAttestations;
    }

    function reputationByUrl(string calldata endpointUrl) external view returns (uint256) {
        return reputation(keccak256(bytes(endpointUrl)));
    }

    /// @notice Full snapshot for a given endpoint URL.
    function getEndpoint(string calldata endpointUrl)
        external
        view
        returns (
            uint64  verifiedCount,
            uint64  failedCount,
            uint64  total,
            uint64  lastVerdictTime,
            bool    lastVerified,
            string  memory claimedModel,
            string  memory detectedModel,
            uint256 rep
        )
    {
        bytes32 id = keccak256(bytes(endpointUrl));
        Endpoint memory e = endpoints[id];
        return (
            e.verifiedCount,
            e.failedCount,
            e.totalAttestations,
            e.lastVerdictTime,
            e.lastVerified,
            e.lastClaimedModel,
            e.lastDetectedModel,
            reputation(id)
        );
    }
}
