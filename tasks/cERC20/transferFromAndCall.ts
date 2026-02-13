import { task } from "hardhat/config";
import addresses from "../../config/addresses";
import { CERC20 } from "../../types";

task("transferFromAndCall", "Transfer cERC20 tokens from one address to another and call")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("tokenaddress", "The address of the token contract")
  .addOptionalParam("from", "sender address")
  .addOptionalParam("to", "receiver address")
  .addOptionalParam("amount", "transfer amount", "1000000") // 1 cERC20
  .setAction(async ({ signeraddress, tokenaddress, to, from, amount }, hre) => {
    const { ethers, deployments, getChainId, getNamedAccounts, fhevm } = hre;
    const chainId = await getChainId();
    const signerAddress = signeraddress || (await getNamedAccounts()).deployer;
    const signer = await ethers.getSigner(signerAddress);

    if (!tokenaddress) {
      const tokenDeployment = await deployments.getOrNull("cERC20");
      tokenaddress = tokenDeployment?.address || addresses[+chainId].cUSDC; // Default to deployed
    }

    if (!to) {
      to = (await getNamedAccounts()).relayer; // Default to relayer address
    }

    if (!from) {
      from = signer.address; // Default to signer address
    }

    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;

    await fhevm.initializeCLIApi();

    const encryptedAmount = await fhevm.createEncryptedInput(tokenaddress, signerAddress).add64(+amount).encrypt();
    await tokenContract["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
      to,
      encryptedAmount.handles[0],
      encryptedAmount.inputProof,
      "0x",
    );

    console.log(`Transferred ${amount} cERC20 tokens from ${from} to ${to} using token ${tokenaddress}`);
  });
