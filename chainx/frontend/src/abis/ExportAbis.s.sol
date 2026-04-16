// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/StakeholderRegistry.sol";
import "../src/ProductRegistry.sol";
import "../src/ZKVerifier.sol";
import "../src/Escrow.sol";

/**
 * @notice Export ABIs to frontend/src/abis/ after forge build.
 *         Run: forge script script/ExportAbis.s.sol
 * ABIs are read from out/ (forge build output) and written to frontend/src/abis/.
 */
contract ExportAbis is Script {
    function run() external {
        // ABIs are already in out/<ContractName>.sol/<ContractName>.json after forge build.
        // This script documents the expected ABI locations.
        // The actual copy is done by the shell script export-abis.sh
        console.log("ABI export: run ./scripts/export-abis.sh after forge build");
    }
}
