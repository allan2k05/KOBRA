// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  KŌBRA Escrow — Trustless Settlement via Yellow ClearNode Proofs
 * @notice Players deposit stakes into per-match escrows.  After the game the
 *         winner (or anyone) calls `settle()` with a ClearNode-signed proof.
 *         The contract recovers the signer via ECDSA, verifies it matches the
 *         trusted ClearNode address, and automatically redistributes funds.
 *
 *         Flow:
 *           1. Both players call `depositForMatch(matchId)` with their stake.
 *           2. Game runs off-chain; every state pushed to Yellow ClearNode.
 *           3. ClearNode signs the final state (matchId ∥ winner ∥ balances).
 *           4. Anyone calls `settle(matchId, winner, signedState)`.
 *           5. Contract verifies signature, pays winner, emits events.
 */
contract Escrow {
    // ───────────── Types ─────────────

    struct Match {
        address player1;
        address player2;
        uint256 stake1;
        uint256 stake2;
        bool    settled;
    }

    // ───────────── State ─────────────

    address public owner;

    /// @notice The trusted ClearNode signer whose signatures authorize settlements.
    address public clearNodeSigner;

    /// @notice Match data keyed by matchId (bytes32).
    mapping(bytes32 => Match) public matches;

    /// @notice General-purpose balance (for legacy deposit/withdraw).
    mapping(address => uint256) public deposits;

    // ───────────── Events ─────────────

    event MatchDeposit(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 payout);
    event ClearNodeSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event Deposit(address indexed player, uint256 amount);
    event Withdrawal(address indexed payee, uint256 amount);

    // ───────────── Constructor ─────────────

    /// @param _clearNodeSigner The address whose private key the ClearNode uses to sign proofs.
    constructor(address _clearNodeSigner) {
        require(_clearNodeSigner != address(0), "Invalid signer");
        owner = msg.sender;
        clearNodeSigner = _clearNodeSigner;
    }

    // ───────────── Modifiers ─────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ═══════════════════════════════════════════════════════════
    //  Match-Based Escrow (Yellow ClearNode integration)
    // ═══════════════════════════════════════════════════════════

    /// @notice Deposit a stake for a specific match.
    ///         The first depositor becomes player1; the second becomes player2.
    /// @param matchId  The unique match identifier (same as on the ClearNode).
    function depositForMatch(bytes32 matchId) external payable {
        require(msg.value > 0, "Must send value");
        Match storage m = matches[matchId];

        if (m.player1 == address(0)) {
            m.player1 = msg.sender;
            m.stake1  = msg.value;
        } else {
            require(m.player2 == address(0), "Match full");
            require(msg.sender != m.player1, "Already joined");
            m.player2 = msg.sender;
            m.stake2  = msg.value;
        }

        emit MatchDeposit(matchId, msg.sender, msg.value);
    }

    /// @notice Settle a match using a ClearNode-signed proof.
    ///         Verifies the ECDSA signature, checks that the winner is a
    ///         participant, and transfers the full pot to the winner.
    /// @param matchId     The match identifier.
    /// @param winner      Address of the winning player.
    /// @param signedState ClearNode ECDSA signature over keccak256(matchId, winner).
    function settle(bytes32 matchId, address winner, bytes calldata signedState) external {
        Match storage m = matches[matchId];

        // ── Guards ──
        require(!m.settled, "Already settled");
        require(m.player1 != address(0) && m.player2 != address(0), "Match not ready");
        require(winner == m.player1 || winner == m.player2, "Winner not in match");

        // ── Verify ClearNode signature ──
        bytes32 messageHash = keccak256(abi.encodePacked(matchId, winner));
        bytes32 ethSignedHash = _toEthSignedMessageHash(messageHash);
        address recovered = _recoverSigner(ethSignedHash, signedState);
        require(recovered == clearNodeSigner, "Invalid ClearNode signature");

        // ── Settle ──
        m.settled = true;
        uint256 payout = m.stake1 + m.stake2;

        (bool success, ) = payable(winner).call{value: payout}("");
        require(success, "Transfer failed");

        emit MatchSettled(matchId, winner, payout);
    }

    /// @notice Check if a match has been settled.
    function isSettled(bytes32 matchId) external view returns (bool) {
        return matches[matchId].settled;
    }

    /// @notice Get full match details.
    function getMatch(bytes32 matchId) external view returns (
        address player1, address player2,
        uint256 stake1,  uint256 stake2,
        bool    settled
    ) {
        Match storage m = matches[matchId];
        return (m.player1, m.player2, m.stake1, m.stake2, m.settled);
    }

    // ═══════════════════════════════════════════════════════════
    //  Legacy General Deposit / Withdraw
    // ═══════════════════════════════════════════════════════════

    function deposit() external payable {
        deposits[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(address payable payee, uint256 amount) external onlyOwner {
        require(deposits[payee] >= amount, "Insufficient balance");
        deposits[payee] -= amount;
        payee.transfer(amount);
        emit Withdrawal(payee, amount);
    }

    // ═══════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════

    /// @notice Update the trusted ClearNode signer (owner-only).
    function setClearNodeSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer");
        emit ClearNodeSignerUpdated(clearNodeSigner, _newSigner);
        clearNodeSigner = _newSigner;
    }

    // ═══════════════════════════════════════════════════════════
    //  Internal ECDSA helpers (no OpenZeppelin dependency)
    // ═══════════════════════════════════════════════════════════

    function _toEthSignedMessageHash(bytes32 hash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recoverSigner(bytes32 hash, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8   v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        // Support both {27,28} and {0,1} for v
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid v value");

        address recovered = ecrecover(hash, v, r, s);
        require(recovered != address(0), "Invalid signature");
        return recovered;
    }
}