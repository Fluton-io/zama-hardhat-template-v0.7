// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC7984ERC20Wrapper} from "./extensions/ERC7984ERC20Wrapper.sol";
import {ERC7984} from "./ERC7984.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract cERC20 is ERC7984ERC20Wrapper, SepoliaConfig {
    constructor(
        IERC20 underlyingToken,
        string memory name_,
        string memory symbol_,
        string memory contractURI_
    ) ERC7984(name_, symbol_, contractURI_) ERC7984ERC20Wrapper(underlyingToken) {}
}
