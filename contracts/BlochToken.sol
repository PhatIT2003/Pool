// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// BLOCH Token Contract
contract BlochToken is ERC20, Ownable {
    constructor() ERC20("BLOCH Token", "BLOCH") Ownable() {
        // Phát hành 240 triệu token ban đầu cho người sở hữu
        _mint(msg.sender, 240_000_000 * 10**decimals());
    }

    // Hàm hủy token
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
