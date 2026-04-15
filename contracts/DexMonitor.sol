// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DexMonitor {
    address public owner;
    
    mapping(address => bool) public trackedWallets;
    mapping(address => bool) public cexWallets;
    
    address[] public trackedList;
    address[] public cexList;

    event WalletTracked(address indexed wallet);
    event CexWalletAdded(address indexed cexWallet);
    event SuspiciousTransaction(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addTrackedWallet(address wallet) external onlyOwner {
        require(!trackedWallets[wallet], "Already tracked");
        trackedWallets[wallet] = true;
        trackedList.push(wallet);
        emit WalletTracked(wallet);
    }

    function addCexWallet(address wallet) external onlyOwner {
        require(!cexWallets[wallet], "Already added");
        cexWallets[wallet] = true;
        cexList.push(wallet);
        emit CexWalletAdded(wallet);
    }

    function reportTransaction(
        address from,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(trackedWallets[from], "Sender not tracked");
        require(cexWallets[to], "Receiver not a CEX wallet");
        emit SuspiciousTransaction(from, to, amount, block.timestamp);
    }

    function getTrackedWallets() external view returns (address[] memory) {
        return trackedList;
    }

    function getCexWallets() external view returns (address[] memory) {
        return cexList;
    }
}