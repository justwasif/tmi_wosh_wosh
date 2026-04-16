// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ZKVerifier.sol";
import "./ProductRegistry.sol";
import "./StakeholderRegistry.sol";

/**
 * @title  Escrow
 * @notice ETH escrow for ZK-verified deliveries.
 *
 *         Flow:
 *           1. Buyer calls createEscrow(productId) with ETH.
 *           2. Off-chain, agent + customer generate a Groth16 proof.
 *           3. Agent calls submitProof(proof, publicSignals).
 *              ZKVerifier checks the proof; on success funds go to agent.
 *           4. If the deadline passes without a proof, buyer calls cancelEscrow()
 *              to get a refund.
 */
contract Escrow {
    // ─── Types ────────────────────────────────────────────────────────────────
    enum EscrowState { Active, Released, Refunded }

    struct EscrowRecord {
        uint256     productId;
        address     buyer;
        address     agent;       // expected delivery agent
        uint256     amount;      // locked ETH (wei)
        uint256     deadline;    // Unix timestamp — refund window
        bytes32     committedHash; // Poseidon pre-image committed at creation
        uint256     windowStart;
        uint256     windowEnd;
        EscrowState state;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    ZKVerifier          public immutable verifier;
    ProductRegistry     public immutable productRegistry;
    StakeholderRegistry public immutable stakeholderRegistry;

    uint256 private _nextEscrowId = 1;
    mapping(uint256 => EscrowRecord) private _escrows;

    // ─── Events ───────────────────────────────────────────────────────────────
    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed productId,
        address indexed buyer,
        address agent,
        uint256 amount,
        uint256 deadline
    );
    event ProofSubmitted(uint256 indexed escrowId, address indexed agent);
    event FundsReleased(uint256 indexed escrowId, address indexed agent, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error EscrowNotFound();
    error NotActive();
    error NotBuyer();
    error NotAgent();
    error DeadlineNotReached();
    error DeadlinePassed();
    error InvalidProof();
    error ZeroValue();
    error TransferFailed();
    error AgentNotRegistered();

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _verifier,
        address _productRegistry,
        address _stakeholderRegistry
    ) {
        verifier            = ZKVerifier(_verifier);
        productRegistry     = ProductRegistry(_productRegistry);
        stakeholderRegistry = StakeholderRegistry(_stakeholderRegistry);
    }

    // ─── Create escrow ────────────────────────────────────────────────────────

    /**
     * @notice Lock ETH for product delivery.
     * @param  productId      On-chain product ID.
     * @param  agent          Expected DELIVERY_AGENT address.
     * @param  committedHash  Poseidon hash of private delivery inputs (agreed off-chain).
     * @param  windowStart    Start of delivery window (Unix timestamp).
     * @param  windowEnd      End of delivery window (Unix timestamp).
     * @param  timeoutSeconds Seconds buyer waits before cancelling.
     */
    function createEscrow(
        uint256 productId,
        address agent,
        bytes32 committedHash,
        uint256 windowStart,
        uint256 windowEnd,
        uint256 timeoutSeconds
    ) external payable returns (uint256 escrowId) {
        if (msg.value == 0) revert ZeroValue();
        if (!stakeholderRegistry.hasRole(agent, stakeholderRegistry.DELIVERY_AGENT()))
            revert AgentNotRegistered();

        escrowId = _nextEscrowId++;

        _escrows[escrowId] = EscrowRecord({
            productId:     productId,
            buyer:         msg.sender,
            agent:         agent,
            amount:        msg.value,
            deadline:      block.timestamp + timeoutSeconds,
            committedHash: committedHash,
            windowStart:   windowStart,
            windowEnd:     windowEnd,
            state:         EscrowState.Active
        });

        emit EscrowCreated(
            escrowId, productId, msg.sender, agent, msg.value,
            block.timestamp + timeoutSeconds
        );
    }

    // ─── Submit ZK proof ──────────────────────────────────────────────────────

    /**
     * @notice Delivery agent submits Groth16 proof. On success, ETH is released.
     * @param  escrowId      The escrow to settle.
     * @param  pA            Proof part A (G1 point).
     * @param  pB            Proof part B (G2 point).
     * @param  pC            Proof part C (G1 point).
     * @param  pubSignals    Public signals: [productId, windowStart, windowEnd, committedHash].
     */
    function submitProof(
        uint256 escrowId,
        uint256[2]    calldata pA,
        uint256[2][2] calldata pB,
        uint256[2]    calldata pC,
        uint256[4]    calldata pubSignals
    ) external {
        EscrowRecord storage e = _getActive(escrowId);

        if (msg.sender != e.agent)              revert NotAgent();
        if (block.timestamp > e.deadline)       revert DeadlinePassed();

        // Public signals must match committed escrow parameters
        // pubSignals[0] = productId, [1] = windowStart, [2] = windowEnd, [3] = committedHash
        if (pubSignals[0] != e.productId)                      revert InvalidProof();
        if (pubSignals[1] != e.windowStart)                    revert InvalidProof();
        if (pubSignals[2] != e.windowEnd)                      revert InvalidProof();
        if (bytes32(pubSignals[3]) != e.committedHash)         revert InvalidProof();

        if (!verifier.verifyProof(pA, pB, pC, pubSignals))    revert InvalidProof();

        e.state = EscrowState.Released;
        uint256 amount = e.amount;

        emit ProofSubmitted(escrowId, msg.sender);
        emit FundsReleased(escrowId, e.agent, amount);

        (bool ok,) = e.agent.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ─── Cancel / refund ──────────────────────────────────────────────────────

    /**
     * @notice Buyer cancels and reclaims ETH after the deadline passes.
     */
    function cancelEscrow(uint256 escrowId) external {
        EscrowRecord storage e = _getActive(escrowId);

        if (msg.sender != e.buyer)           revert NotBuyer();
        if (block.timestamp <= e.deadline)   revert DeadlineNotReached();

        e.state = EscrowState.Refunded;
        uint256 amount = e.amount;

        emit EscrowRefunded(escrowId, e.buyer, amount);

        (bool ok,) = e.buyer.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function getEscrow(uint256 escrowId) external view returns (EscrowRecord memory) {
        if (_escrows[escrowId].buyer == address(0)) revert EscrowNotFound();
        return _escrows[escrowId];
    }

    function totalEscrows() external view returns (uint256) {
        return _nextEscrowId - 1;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _getActive(uint256 escrowId) internal view returns (EscrowRecord storage e) {
        e = _escrows[escrowId];
        if (e.buyer == address(0)) revert EscrowNotFound();
        if (e.state != EscrowState.Active) revert NotActive();
    }
}