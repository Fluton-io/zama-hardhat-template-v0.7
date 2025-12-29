// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import {
    FHE,
    euint64,
    euint32,
    eaddress,
    externalEuint64,
    externalEuint32,
    externalEaddress
} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "./interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

error MsgValueDoesNotMatchInputAmount();
error UnauthorizedRelayer();

contract FHEVMBridge is ZamaEthereumConfig, Ownable2Step {
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
        euint32 destinationChainId;
        FilledStatus filledStatus;
        bool solverPaid;
        uint256 timeout;
    }

    uint256 public fee = 100; // 1%
    address public feeReceiver = 0xBdc3f1A02e56CD349d10bA8D2B038F774ae22731;

    mapping(uint256 intentId => bool exists) public doesIntentExist;

    event IntentCreated(address indexed sender, address indexed relayer, Intent intent);
    event IntentFulfilled(address indexed sender, address indexed relayer, Intent intent);
    event IntentRepaid(address indexed sender, address indexed relayer, Intent intent);
    event RelayerAuthorizationChanged(address indexed relayer, bool authorized);

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
        externalEuint32 _destinationChainId,
        bytes calldata _inputProof
    ) public {
        euint64 encInputAmount = FHE.fromExternal(_encInputAmount, _inputProof);
        euint64 encOutputAmount = FHE.fromExternal(_encOutputAmount, _inputProof);
        euint32 destinationChainId = FHE.fromExternal(_destinationChainId, _inputProof);

        FHE.allowThis(encInputAmount);
        FHE.allowThis(encOutputAmount);
        FHE.allowThis(destinationChainId);

        require(FHE.isSenderAllowed(encInputAmount), "Unauthorized access to encrypted input amount.");
        require(FHE.isSenderAllowed(encOutputAmount), "Unauthorized access to encrypted output amount.");
        require(FHE.isSenderAllowed(destinationChainId), "Unauthorized access to encrypted destination chain ID.");

        FHE.allow(encInputAmount, _sender);
        FHE.allow(encOutputAmount, _sender);
        FHE.allow(destinationChainId, _sender);

        uint256 id = uint256(keccak256(abi.encodePacked(_sender, _receiver, _relayer, block.timestamp, block.number)));

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
            destinationChainId: destinationChainId,
            filledStatus: FilledStatus.NOT_FILLED,
            solverPaid: false,
            timeout: block.timestamp + 24 hours
        });

        FHE.allow(encInputAmount, _inputToken);

        FHE.allow(encInputAmount, _relayer);
        FHE.allow(encOutputAmount, _relayer);
        FHE.allow(destinationChainId, _relayer);

        // if the input token is not WETH, transfer the amount from the sender to the contract (lock)
        IERC7984(_inputToken).confidentialTransferFrom(msg.sender, address(this), encInputAmount);

        doesIntentExist[id] = true;

        emit IntentCreated(_sender, _relayer, intent);
    }

    function fulfill(Intent calldata intent) external {
        if (intent.relayer != msg.sender) {
            revert UnauthorizedRelayer();
        }

        require(FHE.isSenderAllowed(intent.outputAmount), "Unauthorized access to encrypted output amount.");

        FHE.allowThis(intent.outputAmount);
        FHE.allow(intent.outputAmount, intent.outputToken);

        // if the input token is not WETH, transfer the amount from the contract to the receiver
        IERC7984(intent.outputToken).confidentialTransferFrom(intent.relayer, intent.receiver, intent.outputAmount);

        doesIntentExist[intent.id] = true;

        emit IntentFulfilled(intent.sender, intent.relayer, intent);
    }

    function fulfill(Intent calldata intent, externalEuint64 _encOutputAmount, bytes calldata _inputProof) external {
        if (intent.relayer != msg.sender) {
            revert UnauthorizedRelayer();
        }

        euint64 encOutputAmount = FHE.fromExternal(_encOutputAmount, _inputProof);

        FHE.allowThis(encOutputAmount);
        FHE.allow(encOutputAmount, intent.outputToken);

        // if the input token is not WETH, transfer the amount from the contract to the receiver
        IERC7984(intent.outputToken).confidentialTransferFrom(intent.relayer, intent.receiver, encOutputAmount);

        doesIntentExist[intent.id] = true;

        emit IntentFulfilled(intent.sender, intent.relayer, intent);
    }

    function withdraw(
        address tokenAddress,
        externalEuint64 _encryptedAmount,
        bytes calldata _inputProof
    ) public onlyOwner {
        IERC7984(tokenAddress).confidentialTransfer(msg.sender, _encryptedAmount, _inputProof);
    }
}
