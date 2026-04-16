// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./StakeholderRegistry.sol";

/**
 * @title  ProductRegistry
 * @notice Mint products and log every custody transfer on-chain.
 *         Only registered stakeholders may mint or transfer.
 *         Anyone may read the custody history.
 */
contract ProductRegistry {
    // ─── Types ────────────────────────────────────────────────────────────────
    struct Product {
        uint256 id;
        string  metadata;   // IPFS CID or JSON string
        bytes32 originHash; // keccak256 of origin data (factory, batch, etc.)
        address manufacturer;
        address currentHolder;
        uint256 mintedAt;
        bool    exists;
    }

    struct CustodyRecord {
        address from;
        address to;
        uint256 timestamp;
        bytes32 gpsHash;    // optional: set by oracle relayer, else bytes32(0)
    }

    // ─── State ────────────────────────────────────────────────────────────────
    StakeholderRegistry public immutable stakeholderRegistry;

    uint256 private _nextId = 1;

    mapping(uint256 => Product)          private _products;
    mapping(uint256 => CustodyRecord[])  private _custody;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ProductMinted(
        uint256 indexed productId,
        address indexed manufacturer,
        string  metadata,
        bytes32 originHash
    );
    event CustodyTransferred(
        uint256 indexed productId,
        address indexed from,
        address indexed to,
        uint256 timestamp,
        bytes32 gpsHash
    );
    event LocationLogged(
        uint256 indexed productId,
        bytes32 gpsHash,
        uint256 timestamp
    );

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotRegistered();
    error ProductNotFound();
    error NotCurrentHolder();
    error RecipientNotRegistered();

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyStakeholder() {
        if (!stakeholderRegistry.isRegistered(msg.sender)) revert NotRegistered();
        _;
    }

    modifier productExists(uint256 productId) {
        if (!_products[productId].exists) revert ProductNotFound();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address registryAddress) {
        stakeholderRegistry = StakeholderRegistry(registryAddress);
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new product. Caller must be a registered MANUFACTURER.
     * @param  metadata   Off-chain metadata reference (e.g. IPFS CID).
     * @param  originHash keccak256 hash of origin data (factory ID, batch, etc.).
     * @return productId  The new on-chain product ID.
     */
    function mintProduct(
        string calldata metadata,
        bytes32 originHash
    ) external onlyStakeholder returns (uint256 productId) {
        // Enforce MANUFACTURER role specifically
        if (!stakeholderRegistry.hasRole(msg.sender, stakeholderRegistry.MANUFACTURER()))
            revert NotRegistered();

        productId = _nextId++;

        _products[productId] = Product({
            id:            productId,
            metadata:      metadata,
            originHash:    originHash,
            manufacturer:  msg.sender,
            currentHolder: msg.sender,
            mintedAt:      block.timestamp,
            exists:        true
        });

        // Seed custody log with mint record
        _custody[productId].push(CustodyRecord({
            from:      address(0),
            to:        msg.sender,
            timestamp: block.timestamp,
            gpsHash:   bytes32(0)
        }));

        emit ProductMinted(productId, msg.sender, metadata, originHash);
    }

    // ─── Transfer ─────────────────────────────────────────────────────────────

    /**
     * @notice Transfer custody to `to`. Caller must be the current holder.
     * @param  productId The product to transfer.
     * @param  to        Recipient — must be a registered stakeholder.
     * @param  gpsHash   Optional GPS hash at transfer time (bytes32(0) if none).
     */
    function transferCustody(
        uint256 productId,
        address to,
        bytes32 gpsHash
    ) external onlyStakeholder productExists(productId) {
        Product storage p = _products[productId];

        if (p.currentHolder != msg.sender) revert NotCurrentHolder();
        if (!stakeholderRegistry.isRegistered(to)) revert RecipientNotRegistered();

        address from = p.currentHolder;
        p.currentHolder = to;

        _custody[productId].push(CustodyRecord({
            from:      from,
            to:        to,
            timestamp: block.timestamp,
            gpsHash:   gpsHash
        }));

        emit CustodyTransferred(productId, from, to, block.timestamp, gpsHash);
    }

    // ─── Oracle GPS log ───────────────────────────────────────────────────────

    /**
     * @notice Log a GPS hash for a product without changing custody.
     *         Called by the oracle relayer service.
     */
    function logLocation(
        uint256 productId,
        bytes32 gpsHash
    ) external onlyStakeholder productExists(productId) {
        emit LocationLogged(productId, gpsHash, block.timestamp);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (Product memory)
    {
        return _products[productId];
    }

    function getCustodyLog(uint256 productId)
        external
        view
        productExists(productId)
        returns (CustodyRecord[] memory)
    {
        return _custody[productId];
    }

    function currentHolder(uint256 productId)
        external
        view
        productExists(productId)
        returns (address)
    {
        return _products[productId].currentHolder;
    }

    function totalProducts() external view returns (uint256) {
        return _nextId - 1;
    }
}