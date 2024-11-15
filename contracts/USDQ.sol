
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract USDQToken is ERC20, Ownable {
    address public blochPool;

    constructor() ERC20("USDQ Token", "USDQ") Ownable() {
        // No initial supply, will be minted based on BLOCH sales
    }

    modifier onlyBlochPool() {
        require(msg.sender == blochPool, "Only BLOCH Pool can call this");
        _;
    }

    function setBlochPool(address _blochPool) external onlyOwner {
        blochPool = _blochPool;
    }

    function mint(address to, uint256 amount) external onlyBlochPool {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}