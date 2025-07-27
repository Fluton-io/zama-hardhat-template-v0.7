import { task, types } from "hardhat/config";
import { CERC20 } from "../../types";
import addresses from "../../config/addresses";

task("isOperator", "Approve cERC20 contract to spend tokens")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("tokenaddress", "The address of the token contract")
  .addOptionalParam("holderaddress", "The address of the holder")
  .addOptionalParam("spenderaddress", "The address of the spender.")
  .setAction(async ({ signeraddress, tokenaddress, holderaddress, spenderaddress }, hre) => {
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

    if (!holderaddress) {
      holderaddress = signerAddress; // Default to user address
    }

    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;

    const isOperator = await tokenContract.isOperator(holderaddress, spenderaddress);

    console.log(`Is ${spenderaddress} an operator for ${holderaddress} in token ${tokenaddress}?`, isOperator);
  });
