// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/StakeholderRegistry.sol";
import "../src/ProductRegistry.sol";
import "../src/ZKVerifier.sol";
import "../src/Escrow.sol";

contract EscrowTest is Test {
    StakeholderRegistry internal sr;
    ProductRegistry     internal pr;
    ZKVerifier          internal verifier;
    Escrow              internal escrow;

    address internal manufacturer  = makeAddr("manufacturer");
    address internal agent         = makeAddr("agent");
    address internal buyer         = makeAddr("buyer");
    address internal nobody        = makeAddr("nobody");

    uint256 internal productId;

    bytes32 constant COMMITTED = keccak256("delivery-commitment-hash");
    uint256 constant WINDOW_S  = 1_713_340_000;
    uint256 constant WINDOW_E  = 1_713_344_400;
    uint256 constant TIMEOUT   = 2 days;

    // Dummy proof (verifier stub always returns true)
    uint256[2]    internal pA = [uint256(1), uint256(2)];
    uint256[2][2] internal pB = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
    uint256[2]    internal pC = [uint256(7), uint256(8)];

    function setUp() public {
        sr       = new StakeholderRegistry();
        pr       = new ProductRegistry(address(sr));
        verifier = new ZKVerifier();
        escrow   = new Escrow(address(verifier), address(pr), address(sr));

        sr.grantRole(manufacturer, sr.MANUFACTURER());
        sr.grantRole(agent,        sr.DELIVERY_AGENT());

        vm.prank(manufacturer);
        productId = pr.mintProduct("ipfs://QmTest", keccak256("origin"));

        vm.deal(buyer, 10 ether);
    }

    // ─── createEscrow ─────────────────────────────────────────────────────────
    function test_CreateEscrow() public {
        vm.prank(buyer);
        uint256 id = escrow.createEscrow{value: 1 ether}(
            productId, agent, COMMITTED, WINDOW_S, WINDOW_E, TIMEOUT
        );

        assertEq(id, 1);
        Escrow.EscrowRecord memory e = escrow.getEscrow(id);
        assertEq(e.buyer,         buyer);
        assertEq(e.agent,         agent);
        assertEq(e.amount,        1 ether);
        assertEq(e.productId,     productId);
        assertEq(e.committedHash, COMMITTED);
        assertEq(uint8(e.state),  uint8(Escrow.EscrowState.Active));
    }

    function test_CreateEscrow_RevertZeroValue() public {
        vm.prank(buyer);
        vm.expectRevert(Escrow.ZeroValue.selector);
        escrow.createEscrow{value: 0}(
            productId, agent, COMMITTED, WINDOW_S, WINDOW_E, TIMEOUT
        );
    }

    function test_CreateEscrow_RevertAgentNotRegistered() public {
        vm.prank(buyer);
        vm.expectRevert(Escrow.AgentNotRegistered.selector);
        escrow.createEscrow{value: 1 ether}(
            productId, nobody, COMMITTED, WINDOW_S, WINDOW_E, TIMEOUT
        );
    }

    // ─── submitProof ──────────────────────────────────────────────────────────
    function _createEscrow() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createEscrow{value: 1 ether}(
            productId, agent, COMMITTED, WINDOW_S, WINDOW_E, TIMEOUT
        );
    }

    function _pubSignals(uint256 pId, bytes32 committed)
        internal
        pure
        returns (uint256[4] memory)
    {
        return [pId, WINDOW_S, WINDOW_E, uint256(committed)];
    }

    function test_SubmitProof_ReleaseFunds() public {
        uint256 id = _createEscrow();
        uint256 agentBefore = agent.balance;

        vm.prank(agent);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(productId, COMMITTED));

        assertEq(agent.balance, agentBefore + 1 ether);

        Escrow.EscrowRecord memory e = escrow.getEscrow(id);
        assertEq(uint8(e.state), uint8(Escrow.EscrowState.Released));
    }

    function test_SubmitProof_RevertNotAgent() public {
        uint256 id = _createEscrow();
        vm.prank(nobody);
        vm.expectRevert(Escrow.NotAgent.selector);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(productId, COMMITTED));
    }

    function test_SubmitProof_RevertDeadlinePassed() public {
        uint256 id = _createEscrow();
        vm.warp(block.timestamp + TIMEOUT + 1);
        vm.prank(agent);
        vm.expectRevert(Escrow.DeadlinePassed.selector);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(productId, COMMITTED));
    }

    function test_SubmitProof_RevertWrongProductId() public {
        uint256 id = _createEscrow();
        vm.prank(agent);
        vm.expectRevert(Escrow.InvalidProof.selector);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(999, COMMITTED));
    }

    function test_SubmitProof_RevertWrongCommittedHash() public {
        uint256 id = _createEscrow();
        vm.prank(agent);
        vm.expectRevert(Escrow.InvalidProof.selector);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(productId, bytes32(uint256(0xdead))));
    }

    function test_SubmitProof_RevertAlreadyReleased() public {
        uint256 id = _createEscrow();
        vm.prank(agent);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(productId, COMMITTED));

        vm.prank(agent);
        vm.expectRevert(Escrow.NotActive.selector);
        escrow.submitProof(id, pA, pB, pC, _pubSignals(productId, COMMITTED));
    }

    // ─── cancelEscrow ─────────────────────────────────────────────────────────
    function test_CancelEscrow_RefundAfterDeadline() public {
        uint256 id = _createEscrow();
        vm.warp(block.timestamp + TIMEOUT + 1);

        uint256 buyerBefore = buyer.balance;
        vm.prank(buyer);
        escrow.cancelEscrow(id);

        assertEq(buyer.balance, buyerBefore + 1 ether);

        Escrow.EscrowRecord memory e = escrow.getEscrow(id);
        assertEq(uint8(e.state), uint8(Escrow.EscrowState.Refunded));
    }

    function test_CancelEscrow_RevertNotBuyer() public {
        uint256 id = _createEscrow();
        vm.warp(block.timestamp + TIMEOUT + 1);
        vm.prank(nobody);
        vm.expectRevert(Escrow.NotBuyer.selector);
        escrow.cancelEscrow(id);
    }

    function test_CancelEscrow_RevertDeadlineNotReached() public {
        uint256 id = _createEscrow();
        vm.prank(buyer);
        vm.expectRevert(Escrow.DeadlineNotReached.selector);
        escrow.cancelEscrow(id);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────
    function testFuzz_CreateAndRefund(uint96 amount, uint32 timeout) public {
        vm.assume(amount > 0);
        vm.assume(timeout > 0 && timeout < 365 days);

        vm.deal(buyer, amount);
        vm.prank(buyer);
        uint256 id = escrow.createEscrow{value: amount}(
            productId, agent, COMMITTED, WINDOW_S, WINDOW_E, timeout
        );

        vm.warp(block.timestamp + uint256(timeout) + 1);

        uint256 before = buyer.balance;
        vm.prank(buyer);
        escrow.cancelEscrow(id);
        assertEq(buyer.balance, before + amount);
    }
}
