// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  StakeholderRegistry
 * @notice Manages on-chain role assignment for supply-chain participants.
 *         Roles: MANUFACTURER, DISTRIBUTOR, RETAILER, DELIVERY_AGENT.
 *         Only the contract owner can grant or revoke roles.
 */
contract StakeholderRegistry {
    // ─── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant MANUFACTURER   = keccak256("MANUFACTURER");
    bytes32 public constant DISTRIBUTOR    = keccak256("DISTRIBUTOR");
    bytes32 public constant RETAILER       = keccak256("RETAILER");
    bytes32 public constant DELIVERY_AGENT = keccak256("DELIVERY_AGENT");

    // ─── State ───────────────────────────────────────────────────────────────
    address public owner;

    /// @dev stakeholder address => role hash => granted
    mapping(address => mapping(bytes32 => bool)) private _roles;

    /// @dev all known stakeholder addresses (for enumeration off-chain)
    address[] private _stakeholders;
    mapping(address => bool) private _isKnown;

    // ─── Events ──────────────────────────────────────────────────────────────
    event StakeholderRegistered(address indexed stakeholder, bytes32 indexed role);
    event StakeholderRevoked(address indexed stakeholder, bytes32 indexed role);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error Unauthorized();
    error InvalidRole();
    error AlreadyGranted();
    error NotGranted();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── Owner actions ───────────────────────────────────────────────────────

    /**
     * @notice Grant `role` to `stakeholder`.
     * @dev    Reverts if the role is already granted.
     */
    function grantRole(address stakeholder, bytes32 role) external onlyOwner {
        if (stakeholder == address(0)) revert ZeroAddress();
        if (!_isValidRole(role)) revert InvalidRole();
        if (_roles[stakeholder][role]) revert AlreadyGranted();

        _roles[stakeholder][role] = true;

        if (!_isKnown[stakeholder]) {
            _isKnown[stakeholder] = true;
            _stakeholders.push(stakeholder);
        }

        emit StakeholderRegistered(stakeholder, role);
    }

    /**
     * @notice Revoke `role` from `stakeholder`.
     * @dev    Reverts if the role was not previously granted.
     */
    function revokeRole(address stakeholder, bytes32 role) external onlyOwner {
        if (!_isValidRole(role)) revert InvalidRole();
        if (!_roles[stakeholder][role]) revert NotGranted();

        _roles[stakeholder][role] = false;
        emit StakeholderRevoked(stakeholder, role);
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /**
     * @notice Returns true if `stakeholder` has `role`.
     */
    function hasRole(address stakeholder, bytes32 role) external view returns (bool) {
        return _roles[stakeholder][role];
    }

    /**
     * @notice Returns true if `stakeholder` has ANY recognised role.
     */
    function isRegistered(address stakeholder) external view returns (bool) {
        return _roles[stakeholder][MANUFACTURER]
            || _roles[stakeholder][DISTRIBUTOR]
            || _roles[stakeholder][RETAILER]
            || _roles[stakeholder][DELIVERY_AGENT];
    }

    /**
     * @notice Returns all known stakeholder addresses (including revoked ones).
     */
    function allStakeholders() external view returns (address[] memory) {
        return _stakeholders;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────
    function _isValidRole(bytes32 role) internal pure returns (bool) {
        return role == MANUFACTURER
            || role == DISTRIBUTOR
            || role == RETAILER
            || role == DELIVERY_AGENT;
    }
}