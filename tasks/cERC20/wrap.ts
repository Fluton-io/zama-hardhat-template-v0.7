import { task } from "hardhat/config";
import addresses from "../../config/addresses";
import { CERC20 } from "../../types";

task("wrap", "Wrap your erc20 into cERC20")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("tokenaddress", "The address of the token contract")
  .addOptionalParam("to", "The address to send the wrapped tokens")
  .addOptionalParam("amount", "The amount of tokens to wrap", "1000000000000000000")
  .setAction(async ({ signeraddress, tokenaddress, to, amount }, hre) => {
    const { ethers, getChainId, fhevm, deployments, getNamedAccounts } = hre;
    const chainId = await getChainId();
    const signerAddress = signeraddress || (await getNamedAccounts()).user;
    const signer = await ethers.getSigner(signerAddress);

    if (!to) {
      to = signer.address;
    }

    if (!tokenaddress) {
      const tokenDeployment = await deployments.get("cERC20");
      tokenaddress = tokenDeployment.address || addresses[+chainId].cUSDC; // Default to deployed
    }

    console.log(signer.address, tokenaddress, amount);

    // Wrap logic goes here
    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;
    await fhevm.initializeCLIApi();
    await tokenContract.wrap(to, amount);

    console.log(`Wrapped ${amount} of tokens from ${signer.address} to ${to} in token ${tokenaddress}`);
  });
