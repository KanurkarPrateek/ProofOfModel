// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProofOfModel — PrepaidGateway
/// @notice Kills the "stealable API key" that powers token theft. Instead of a
///         long-lived, unlimited bearer secret, an agent gets:
///           - a prepaid MON balance held on Monad,
///           - scoped *sessions* (spend cap + expiry + instant revoke),
///           - per-call on-chain metering.
///         The gateway operator holds the real upstream provider key server-side
///         and settles each served call here. A leaked session key can drain at
///         most its remaining cap, and the owner can revoke or withdraw instantly.
contract PrepaidGateway {
    address public owner; // gateway operator (relayer) that settles served calls

    struct Session {
        address user;    // who funded / owns this session
        uint256 cap;     // max total spend for this session (wei)
        uint256 spent;   // spent so far (wei)
        uint64  expiry;  // unix seconds
        bool    revoked;
    }

    mapping(address => uint256) public balance;  // user -> prepaid balance (wei)
    mapping(bytes32 => Session)  public sessions; // sessionId -> session

    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount);
    event SessionOpened(
        bytes32 indexed sessionId,
        address indexed user,
        address sessionKey,
        uint256 cap,
        uint64 expiry
    );
    event SessionRevoked(bytes32 indexed sessionId);
    event Debited(
        bytes32 indexed sessionId,
        address indexed user,
        uint256 amount,
        string model,
        uint32 tokens
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /// @notice sessionId is derived from the ephemeral session key address the
    ///         agent signs its requests with.
    function sessionId(address sessionKey) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sessionKey));
    }

    /// @notice Prepay into your gateway balance.
    function deposit() external payable {
        balance[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, balance[msg.sender]);
    }

    /// @notice Authorize an ephemeral session key with a spend cap + expiry.
    function openSession(address sessionKey, uint256 cap, uint64 expiry) external {
        require(sessionKey != address(0), "bad key");
        require(expiry > block.timestamp, "expiry in past");
        bytes32 id = sessionId(sessionKey);
        require(sessions[id].user == address(0), "session exists");
        sessions[id] = Session(msg.sender, cap, 0, expiry, false);
        emit SessionOpened(id, msg.sender, sessionKey, cap, expiry);
    }

    /// @notice Revoke a session immediately (blast-radius kill switch).
    function revokeSession(bytes32 id) external {
        Session storage s = sessions[id];
        require(s.user == msg.sender, "not your session");
        s.revoked = true;
        emit SessionRevoked(id);
    }

    /// @notice Operator settles a served inference call.
    function debit(
        bytes32 id,
        uint256 amount,
        string calldata model,
        uint32 tokens
    ) external onlyOwner {
        Session storage s = sessions[id];
        require(s.user != address(0), "no session");
        require(!s.revoked, "session revoked");
        require(block.timestamp <= s.expiry, "session expired");
        require(s.spent + amount <= s.cap, "session cap exceeded");
        require(balance[s.user] >= amount, "insufficient balance");

        s.spent += amount;
        balance[s.user] -= amount;
        balance[owner] += amount; // fees accrue to the operator (→ provider payout)

        emit Debited(id, s.user, amount, model, tokens);
    }

    /// @notice Withdraw unspent balance (stops the bleeding if a key leaks).
    function withdraw(uint256 amount) external {
        require(balance[msg.sender] >= amount, "insufficient balance");
        balance[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Read a session by its ephemeral key address.
    function sessionOf(address sessionKey)
        external
        view
        returns (
            address user,
            uint256 cap,
            uint256 spent,
            uint64 expiry,
            bool revoked,
            uint256 userBalance
        )
    {
        Session memory s = sessions[sessionId(sessionKey)];
        return (s.user, s.cap, s.spent, s.expiry, s.revoked, balance[s.user]);
    }
}
