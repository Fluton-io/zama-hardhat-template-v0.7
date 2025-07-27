import { task, types } from "hardhat/config";
import { CERC20 } from "../../types";
import addresses from "../../config/addresses";

task("setOperator", "Set an operator for cERC20 tokens")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("tokenaddress", "The address of the token contract")
  .addOptionalParam("spenderaddress", "The address of the spender.")
  .addOptionalParam("timestamp", "The timestamp for the operator", Math.floor(Date.now() / 1000) + 60 * 60, types.int)
  .setAction(async ({ signeraddress, tokenaddress, spenderaddress, timestamp }, hre) => {
    const { ethers, getChainId, getNamedAccounts } = hre;
    const chainId = await getChainId();
    const signerAddress = signeraddress || (await getNamedAccounts()).user;
    const signer = await ethers.getSigner(signerAddress);

    if (!tokenaddress) {
      tokenaddress = addresses[+chainId].cUSDC; // Default to deployed
    }

    if (!spenderaddress) {
      spenderaddress = signerAddress; // Default to user address
    }

    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;

    await tokenContract.setOperator(spenderaddress, timestamp);
  });
