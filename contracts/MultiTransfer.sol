// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "./interfaces/IERC7984.sol";

contract MultiTransfer is ReentrancyGuard {
    function multiTokenTransfer(
        address[] calldata tokens,
        address to,
        externalEuint64[] calldata amounts,
        bytes calldata _inputProof
    ) external nonReentrant {
        require(tokens.length == amounts.length, "Mismatched input lengths");
        for (uint256 i = 0; i < tokens.length; i++) {
            euint64 encAmount = FHE.fromExternal(amounts[i], _inputProof);
            FHE.allow(encAmount, tokens[i]);
            FHE.allow(encAmount, to);
            FHE.allow(encAmount, msg.sender);
            IERC7984(tokens[i]).confidentialTransferFrom(
                msg.sender,
                to,
                encAmount
            );
        }
    }
}
