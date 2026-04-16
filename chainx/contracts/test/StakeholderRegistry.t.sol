// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/StakeholderRegistry.sol";

contract StakeholderRegistryTest is Test {
    StakeholderRegistry internal registry;

    address internal owner   = address(this);
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal charlie = makeAddr("charlie");

    function setUp() public {
        registry = new StakeholderRegistry();
    }

    // ─── Ownership ────────────────────────────────────────────────────────────
    function test_OwnerIsDeployer() public view {
        assertEq(registry.owner(), owner);
    }

    function test_TransferOwnership() public {
        registry.transferOwnership(alice);
        assertEq(registry.owner(), alice);
    }

    function test_TransferOwnership_RevertZeroAddress() public {
        vm.expectRevert(StakeholderRegistry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    // ─── Grant ────────────────────────────────────────────────────────────────
    function test_GrantManufacturer() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        assertTrue(registry.hasRole(alice, registry.MANUFACTURER()));
        assertTrue(registry.isRegistered(alice));
    }

    function test_GrantAllRoles() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        registry.grantRole(bob,   registry.DISTRIBUTOR());
        registry.grantRole(charlie, registry.RETAILER());

        address agent = makeAddr("agent");
        registry.grantRole(agent, registry.DELIVERY_AGENT());

        assertTrue(registry.hasRole(alice,   registry.MANUFACTURER()));
        assertTrue(registry.hasRole(bob,     registry.DISTRIBUTOR()));
        assertTrue(registry.hasRole(charlie, registry.RETAILER()));
        assertTrue(registry.hasRole(agent,   registry.DELIVERY_AGENT()));
    }

    function test_GrantRole_EmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit StakeholderRegistry.StakeholderRegistered(alice, registry.MANUFACTURER());
        registry.grantRole(alice, registry.MANUFACTURER());
    }

    function test_GrantRole_RevertUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(StakeholderRegistry.Unauthorized.selector);
        registry.grantRole(bob, registry.MANUFACTURER());
    }

    function test_GrantRole_RevertInvalidRole() public {
        vm.expectRevert(StakeholderRegistry.InvalidRole.selector);
        registry.grantRole(alice, keccak256("HACKER"));
    }

    function test_GrantRole_RevertAlreadyGranted() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        vm.expectRevert(StakeholderRegistry.AlreadyGranted.selector);
        registry.grantRole(alice, registry.MANUFACTURER());
    }

    function test_GrantRole_RevertZeroAddress() public {
        vm.expectRevert(StakeholderRegistry.ZeroAddress.selector);
        registry.grantRole(address(0), registry.MANUFACTURER());
    }

    // ─── Revoke ───────────────────────────────────────────────────────────────
    function test_RevokeRole() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        registry.revokeRole(alice, registry.MANUFACTURER());
        assertFalse(registry.hasRole(alice, registry.MANUFACTURER()));
    }

    function test_RevokeRole_EmitsEvent() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        vm.expectEmit(true, true, false, false);
        emit StakeholderRegistry.StakeholderRevoked(alice, registry.MANUFACTURER());
        registry.revokeRole(alice, registry.MANUFACTURER());
    }

    function test_RevokeRole_RevertNotGranted() public {
        vm.expectRevert(StakeholderRegistry.NotGranted.selector);
        registry.revokeRole(alice, registry.MANUFACTURER());
    }

    function test_RevokeRole_RevertUnauthorized() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        vm.prank(alice);
        vm.expectRevert(StakeholderRegistry.Unauthorized.selector);
        registry.revokeRole(alice, registry.MANUFACTURER());
    }

    // ─── Enumeration ──────────────────────────────────────────────────────────
    function test_AllStakeholders() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        registry.grantRole(bob,   registry.DISTRIBUTOR());

        address[] memory all = registry.allStakeholders();
        assertEq(all.length, 2);
        assertEq(all[0], alice);
        assertEq(all[1], bob);
    }

    function test_DuplicateGrantDoesNotDuplicateInArray() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        vm.expectRevert(StakeholderRegistry.AlreadyGranted.selector);
        registry.grantRole(alice, registry.MANUFACTURER());

        // alice should still appear only once
        assertEq(registry.allStakeholders().length, 1);
    }

    // ─── isRegistered after revoke ────────────────────────────────────────────
    function test_IsNotRegisteredAfterAllRolesRevoked() public {
        registry.grantRole(alice, registry.MANUFACTURER());
        registry.revokeRole(alice, registry.MANUFACTURER());
        assertFalse(registry.isRegistered(alice));
    }
}
