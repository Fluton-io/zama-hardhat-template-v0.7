import { task } from "hardhat/config";
import addresses from "../../config/addresses";
import { CERC20 } from "../../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

task("balanceOf", "Get user balance")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("tokenaddress", "The address of the token contract")
  .addOptionalParam("useraddress", "The address of the user")
  .setAction(async ({ signeraddress, tokenaddress, useraddress }, hre) => {
    const { ethers, getChainId, getNamedAccounts, fhevm } = hre;
    const chainId = await getChainId();
    const userAddress = useraddress || (await getNamedAccounts()).user;
    const signerAddress = signeraddress || (await getNamedAccounts()).user;
    const signer = await ethers.getSigner(signerAddress);

    if (!addresses[+chainId]) {
      throw new Error("Chain ID not supported");
    }

    if (!tokenaddress) {
      tokenaddress = addresses[+chainId].cUSDC; // Default to deployed
    }

    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;
    const encryptedBalance = await tokenContract.confidentialBalanceOf(userAddress);

    console.log(`Encrypted Balance of ${userAddress} in token ${tokenaddress} is`, encryptedBalance.toString());

    await fhevm.initializeCLIApi();
    const decryptedBalance = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalance, tokenaddress, signer);
    console.log(`Decrypted Balance of ${userAddress} in token ${tokenaddress} is`, decryptedBalance.toString());
  });
