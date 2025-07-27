import { task } from "hardhat/config";
import { CERC20 } from "../../types";
import addresses from "../../config/addresses";

task("unwrap", "Unwrap your erc20 into cERC20")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("tokenaddress", "The address of the token contract")
  .addOptionalParam("from", "The address to unwrap from")
  .addOptionalParam("to", "The address to send the wrapped tokens")
  .addOptionalParam("amount", "The amount of tokens to unwrap", "1000000")
  .setAction(async ({ signeraddress, tokenaddress, from, to, amount }, hre) => {
    const { ethers, getChainId, fhevm, deployments, getNamedAccounts } = hre;
    const chainId = await getChainId();
    const signerAddress = signeraddress || (await getNamedAccounts()).user;
    const signer = await ethers.getSigner(signerAddress);

    if (!from) {
      from = signer.address; // Default to signer address
    }

    if (!to) {
      to = signer.address;
    }

    if (!tokenaddress) {
      const tokenDeployment = await deployments.get("cERC20");
      tokenaddress = tokenDeployment.address || addresses[+chainId].cUSDC; // Default to deployed
    }

    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;

    await fhevm.initializeCLIApi();

    const encryptedAmount = await fhevm.createEncryptedInput(tokenaddress, signerAddress).add64(+amount).encrypt();
    await tokenContract["unwrap(address,address,bytes32,bytes)"](
      from,
      to,
      encryptedAmount.handles[0],
      encryptedAmount.inputProof,
    );

    console.log(
      `Unwrapped ${amount} of tokens from ${from} to ${to} in token ${tokenaddress}. Since unwrapping is asyncronous, you may need to wait for the gateway's transaction to be mined to see the result.`,
    );
  });
