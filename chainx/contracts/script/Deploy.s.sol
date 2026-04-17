// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/StakeholderRegistry.sol";
import "../src/ProductRegistry.sol";
import "../src/ZKVerifier.sol";
import "../src/Escrow.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy StakeholderRegistry
        StakeholderRegistry stakeholderRegistry = new StakeholderRegistry();
        console.log("StakeholderRegistry deployed at:", address(stakeholderRegistry));

        // Deploy ProductRegistry
        ProductRegistry productRegistry = new ProductRegistry(address(stakeholderRegistry));
        console.log("ProductRegistry deployed at:", address(productRegistry));

        // Deploy ZKVerifier
        ZKVerifier verifier = new ZKVerifier();
        console.log("ZKVerifier deployed at:", address(verifier));

        // Deploy Escrow
        Escrow escrow = new Escrow(address(verifier), address(productRegistry), address(stakeholderRegistry));
        console.log("Escrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }
}