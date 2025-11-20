import { task } from "hardhat/config";
import addresses from "../../config/addresses";
import { FHEVMBridge } from "../../types";

task("bridge", "Bridge cERC20 tokens to FHEVM")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("bridgeaddress", "The address of the bridge contract")
  .addOptionalParam("receiveraddress", "receiver address")
  .addOptionalParam("relayeraddress", "relayer address")
  .addOptionalParam("inputtokenaddress", "The address of the input token contract")
  .addOptionalParam("outputtokenaddress", "The address of the output token contract")
  .addOptionalParam("inputamount", "amount to bridge", "1000000") // 1 cERC20
  .addOptionalParam("outputamount", "amount intended to receive on the destination chain", "1000000") // 1 cERC20
  .addOptionalParam("destinationchainid", "destination chain id", "421614")
  .setAction(
    async (
      {
        signeraddress,
        bridgeaddress,
        receiveraddress,
        relayeraddress,
        inputtokenaddress,
        outputtokenaddress,
        inputamount,
        outputamount,
        destinationchainid,
      },
      hre,
    ) => {
      const { ethers, deployments, getChainId, getNamedAccounts, fhevm } = hre;
      const chainId = await getChainId();
      const signerAddress = signeraddress || (await getNamedAccounts()).user;
      const signer = await ethers.getSigner(signerAddress);

      if (!inputtokenaddress) {
        const tokenDeployment = await deployments.getOrNull("cERC20");
        inputtokenaddress = tokenDeployment?.address || addresses[+chainId].cUSDC; // Default to deployed
      }

      if (!bridgeaddress) {
        const bridgeDeployment = await deployments.getOrNull("FHEVMBridge");
        bridgeaddress = bridgeDeployment?.address || addresses[+chainId].FHEVMBridge; // Default to deployed bridge address
      }

      if (!outputtokenaddress) {
        if (addresses[+destinationchainid] === undefined) {
          throw new Error(
            `Please either provide the output token address or ensure the destination chain ID ${destinationchainid} is defined in addresses.ts`,
          );
        }
        outputtokenaddress = addresses[+destinationchainid].cUSDC; // Default to deployed output token address
      }

      if (!receiveraddress) {
        receiveraddress = signerAddress; // Default to signer address
      }

      if (!relayeraddress) {
        relayeraddress = (await getNamedAccounts()).relayer; // Default to relayer address
      }

      const bridgeContract = (await ethers.getContractAt("FHEVMBridge", bridgeaddress, signer)) as FHEVMBridge;

      await fhevm.initializeCLIApi();
      const encryptedAmounts = await fhevm
        .createEncryptedInput(bridgeaddress, signerAddress)
        .add64(+inputamount)
        .add64(+outputamount)
        .add32(+destinationchainid)
        .encrypt();

      const tx = await bridgeContract.bridge(
        signerAddress,
        signerAddress,
        relayeraddress,
        inputtokenaddress,
        outputtokenaddress,
        encryptedAmounts.handles[0],
        encryptedAmounts.handles[1],
        encryptedAmounts.handles[2],
        encryptedAmounts.inputProof,
      );

      console.log(
        `Bridging ${inputamount} cERC20 tokens from ${signerAddress} to ${receiveraddress} on chain ${destinationchainid}`,
      );
      console.log(`Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`Bridging completed successfully. 🤌`);
    },
  );
