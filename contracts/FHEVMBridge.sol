// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IConfidentialFungibleToken} from "./interfaces/IConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

error MsgValueDoesNotMatchInputAmount();
error UnauthorizedRelayer();

contract FHEVMBridge is SepoliaConfig, Ownable2Step {
    enum FilledStatus {
        NOT_FILLED,
        FILLED
    }

    struct Intent {
        address sender;
        address receiver;
        address relayer;
        address inputToken;
        address outputToken;
        euint64 inputAmount;
        euint64 outputAmount;
        uint256 id;
        uint32 originChainId;
        uint32 destinationChainId;
        FilledStatus filledStatus;
    }

    uint256 public fee = 100; // 1%
    address public feeReceiver = 0xBdc3f1A02e56CD349d10bA8D2B038F774ae22731;

    mapping(uint256 intentId => bool exists) public doesIntentExist;

    event IntentFulfilled(Intent intent);
    event IntentCreated(Intent intent);
    event IntentRepaid(Intent intent);

    // WETH contract can not e used yet.
    // _ibcHandler and _timeout were not implemented yet.
    constructor() Ownable(msg.sender) {}

    function bridge(
        address _sender,
        address _receiver,
        address _relayer,
        address _inputToken,
        address _outputToken,
        externalEuint64 _encInputAmount,
        externalEuint64 _encOutputAmount,
        uint32 _destinationChainId,
        bytes calldata _inputProof
    ) public {
        euint64 encInputAmount = FHE.fromExternal(_encInputAmount, _inputProof);
        euint64 encOutputAmount = FHE.fromExternal(_encOutputAmount, _inputProof);

        FHE.allowThis(encInputAmount);
        FHE.allowThis(encOutputAmount);

        require(FHE.isSenderAllowed(encInputAmount), "Unauthorized access to encrypted input amount.");
        require(FHE.isSenderAllowed(encOutputAmount), "Unauthorized access to encrypted output amount.");
        uint256 id = uint256(
            keccak256(
                abi.encodePacked(
                    _sender,
                    _receiver,
                    _relayer,
                    _inputToken,
                    _outputToken,
                    encInputAmount,
                    encOutputAmount,
                    _destinationChainId,
                    block.timestamp
                )
            )
        );

        Intent memory intent = Intent({
            sender: _sender,
            receiver: _receiver,
            relayer: _relayer,
            inputToken: _inputToken,
            outputToken: _outputToken,
            inputAmount: encInputAmount,
            outputAmount: encOutputAmount,
            id: id,
            originChainId: uint32(block.chainid),
            destinationChainId: _destinationChainId,
            filledStatus: FilledStatus.NOT_FILLED
        });

        FHE.allow(encInputAmount, _inputToken);

        FHE.allow(encInputAmount, _relayer);
        FHE.allow(encOutputAmount, _relayer);

        // if the input token is not WETH, transfer the amount from the sender to the contract (lock)
        IConfidentialFungibleToken(_inputToken).confidentialTransferFrom(msg.sender, address(this), encInputAmount);

        doesIntentExist[id] = true;

        emit IntentCreated(intent);
    }

    function fulfill(Intent calldata intent) external {
        if (intent.relayer != msg.sender) {
            revert UnauthorizedRelayer();
        }

        require(FHE.isSenderAllowed(intent.inputAmount), "Unauthorized access to encrypted input amount.");
        require(FHE.isSenderAllowed(intent.outputAmount), "Unauthorized access to encrypted output amount.");

        FHE.allowThis(intent.inputAmount);
        FHE.allowThis(intent.outputAmount);

        FHE.allow(intent.outputAmount, intent.outputToken);

        FHE.allow(intent.inputAmount, intent.relayer);
        FHE.allow(intent.outputAmount, intent.relayer);

        // if the input token is not WETH, transfer the amount from the contract to the receiver
        IConfidentialFungibleToken(intent.outputToken).confidentialTransferFrom(
            intent.relayer,
            intent.receiver,
            intent.outputAmount
        );

        doesIntentExist[intent.id] = true;

        emit IntentFulfilled(intent);
    }

    function withdraw(
        address tokenAddress,
        externalEuint64 _encryptedAmount,
        bytes calldata _inputProof
    ) public onlyOwner {
        IConfidentialFungibleToken(tokenAddress).confidentialTransfer(msg.sender, _encryptedAmount, _inputProof);
    }
}
