// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    address public owner;
    mapping(address => uint256) public deposits;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        deposits[msg.sender] += msg.value;
    }

    function withdraw(address payable payee, uint256 amount) external {
        require(msg.sender == owner, "Only owner can withdraw");
        require(deposits[payee] >= amount, "Insufficient balance");

        deposits[payee] -= amount;
        payee.transfer(amount);
    }
}