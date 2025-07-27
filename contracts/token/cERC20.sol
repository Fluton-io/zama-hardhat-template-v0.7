// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ConfidentialFungibleTokenERC20Wrapper} from "./extensions/ConfidentialFungibleTokenERC20Wrapper.sol";
import {ConfidentialFungibleToken} from "./ConfidentialFungibleToken.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

contract cERC20 is ConfidentialFungibleTokenERC20Wrapper {
    constructor(
        IERC20 underlyingToken,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ConfidentialFungibleToken(name_, symbol_, tokenURI_) ConfidentialFungibleTokenERC20Wrapper(underlyingToken) {}
}
