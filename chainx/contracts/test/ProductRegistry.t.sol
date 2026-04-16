// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/StakeholderRegistry.sol";
import "../src/ProductRegistry.sol";

contract ProductRegistryTest is Test {
    StakeholderRegistry internal registry;
    ProductRegistry     internal products;

    address internal manufacturer  = makeAddr("manufacturer");
    address internal distributor   = makeAddr("distributor");
    address internal retailer      = makeAddr("retailer");
    address internal deliveryAgent = makeAddr("deliveryAgent");
    address internal nobody        = makeAddr("nobody");

    string  constant META   = "ipfs://QmTestHash";
    bytes32 constant ORIGIN = keccak256("factory-A/batch-001");

    function setUp() public {
        registry = new StakeholderRegistry();
        products = new ProductRegistry(address(registry));

        registry.grantRole(manufacturer,  registry.MANUFACTURER());
        registry.grantRole(distributor,   registry.DISTRIBUTOR());
        registry.grantRole(retailer,      registry.RETAILER());
        registry.grantRole(deliveryAgent, registry.DELIVERY_AGENT());
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────
    function test_MintProduct() public {
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        assertEq(id, 1);
        ProductRegistry.Product memory p = products.getProduct(id);
        assertEq(p.manufacturer,  manufacturer);
        assertEq(p.currentHolder, manufacturer);
        assertEq(p.metadata,      META);
        assertEq(p.originHash,    ORIGIN);
        assertTrue(p.exists);
    }

    function test_MintProduct_EmitsEvent() public {
        vm.prank(manufacturer);
        vm.expectEmit(true, true, false, true);
        emit ProductRegistry.ProductMinted(1, manufacturer, META, ORIGIN);
        products.mintProduct(META, ORIGIN);
    }

    function test_MintProduct_SeedsCustodyLog() public {
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        ProductRegistry.CustodyRecord[] memory log = products.getCustodyLog(id);
        assertEq(log.length, 1);
        assertEq(log[0].from, address(0));
        assertEq(log[0].to,   manufacturer);
    }

    function test_Mint_RevertNonManufacturer() public {
        vm.prank(distributor);
        vm.expectRevert(ProductRegistry.NotRegistered.selector);
        products.mintProduct(META, ORIGIN);
    }

    function test_Mint_RevertNobody() public {
        vm.prank(nobody);
        vm.expectRevert(ProductRegistry.NotRegistered.selector);
        products.mintProduct(META, ORIGIN);
    }

    // ─── Transfer custody ─────────────────────────────────────────────────────
    function test_TransferCustody_ManufacturerToDistributor() public {
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        bytes32 gps = keccak256(abi.encodePacked("28.6139,77.2090", block.timestamp));

        vm.prank(manufacturer);
        products.transferCustody(id, distributor, gps);

        assertEq(products.currentHolder(id), distributor);

        ProductRegistry.CustodyRecord[] memory log = products.getCustodyLog(id);
        assertEq(log.length, 2);
        assertEq(log[1].from,    manufacturer);
        assertEq(log[1].to,      distributor);
        assertEq(log[1].gpsHash, gps);
    }

    function test_FullLifecycle_MintDistributeRetailDeliver() public {
        // 1. Mint
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        // 2. Manufacturer → Distributor
        vm.prank(manufacturer);
        products.transferCustody(id, distributor, bytes32(0));
        assertEq(products.currentHolder(id), distributor);

        // 3. Distributor → Retailer
        vm.prank(distributor);
        products.transferCustody(id, retailer, bytes32(0));
        assertEq(products.currentHolder(id), retailer);

        // 4. Retailer → Delivery Agent
        vm.prank(retailer);
        products.transferCustody(id, deliveryAgent, bytes32(0));
        assertEq(products.currentHolder(id), deliveryAgent);

        // Verify full custody log
        ProductRegistry.CustodyRecord[] memory log = products.getCustodyLog(id);
        assertEq(log.length, 4); // mint + 3 transfers
    }

    function test_Transfer_RevertNotCurrentHolder() public {
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        vm.prank(distributor);
        vm.expectRevert(ProductRegistry.NotCurrentHolder.selector);
        products.transferCustody(id, retailer, bytes32(0));
    }

    function test_Transfer_RevertRecipientNotRegistered() public {
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        vm.prank(manufacturer);
        vm.expectRevert(ProductRegistry.RecipientNotRegistered.selector);
        products.transferCustody(id, nobody, bytes32(0));
    }

    function test_Transfer_RevertProductNotFound() public {
        vm.prank(manufacturer);
        vm.expectRevert(ProductRegistry.ProductNotFound.selector);
        products.transferCustody(999, distributor, bytes32(0));
    }

    // ─── Location log ─────────────────────────────────────────────────────────
    function test_LogLocation_EmitsEvent() public {
        vm.prank(manufacturer);
        uint256 id = products.mintProduct(META, ORIGIN);

        bytes32 gps = keccak256("coords");
        vm.prank(manufacturer);
        vm.expectEmit(true, false, false, true);
        emit ProductRegistry.LocationLogged(id, gps, block.timestamp);
        products.logLocation(id, gps);
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function test_TotalProducts() public {
        assertEq(products.totalProducts(), 0);
        vm.startPrank(manufacturer);
        products.mintProduct(META, ORIGIN);
        products.mintProduct("ipfs://QmOther", bytes32(0));
        vm.stopPrank();
        assertEq(products.totalProducts(), 2);
    }
}
