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
    const signerAddress = signeraddress || (await getNamedAccounts()).deployer;
    const signer = await ethers.getSigner(signerAddress);

    if (!to) {
      to = signer.address;
    }

    if (!tokenaddress) {
      const tokenDeployment = await deployments.getOrNull("cERC20");
      tokenaddress = tokenDeployment?.address || addresses[+chainId].cUSDC; // Default to deployed
    }

    console.log(signer.address, tokenaddress, amount);

    // Wrap logic goes here
    const cTokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;
    const tokenAddress = await cTokenContract.underlying();
    const tokenContract = await ethers.getContractAt("IERC20", tokenAddress, signer);
    const allowance = await tokenContract.allowance(signer.address, tokenaddress);

    if (allowance < amount) {
      console.log(`Approving ${amount} tokens for wrapping...`);
      const approveTx = await tokenContract.approve(tokenaddress, amount);
      await approveTx.wait();
      console.log(`Approved ${amount} tokens for wrapping.`);
    } else {
      console.log(`Sufficient allowance already exists: ${allowance.toString()}`);
    }
    await fhevm.initializeCLIApi();
    await cTokenContract.wrap(to, amount);

    console.log(`Wrapped ${amount} of tokens from ${signer.address} to ${to} in token ${tokenaddress}`);
  });
