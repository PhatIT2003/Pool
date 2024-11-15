// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDTToken is ERC20, Ownable {

    constructor() ERC20("Tether USD", "USDT") Ownable() {}

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    function mint(address to, uint256 _amount) external  onlyOwner {
        _mint(to, _amount);
    }
}