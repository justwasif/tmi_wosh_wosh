// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/StakeholderRegistry.sol";

contract GrantRole is Script {
    function run() external {
        // Your wallet address that needs a role
        address userAddress = 0x087cd45C39150Aa725DDC03C3b83f60F2582619c;

        // StakeholderRegistry contract address
        address registryAddress = 0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519;

        StakeholderRegistry registry = StakeholderRegistry(registryAddress);

        vm.startBroadcast();

        // Grant MANUFACTURER role to the user
        registry.grantRole(userAddress, keccak256("MANUFACTURER"));

        console.log("Granted MANUFACTURER role to:", userAddress);

        vm.stopBroadcast();
    }
}