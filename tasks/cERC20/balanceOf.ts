import { task } from "hardhat/config";
import addresses from "../../config/addresses";
import { CERC20 } from "../../types";

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

    await fhevm.initializeCLIApi();

    const keypair = fhevm.generateKeypair();
    const handleContractPairs = [
      {
        handle: encryptedBalance.toString() as `0x${string}`,
        contractAddress: tokenaddress,
      },
    ];
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // String for consistency
    const contractAddresses = [tokenaddress];

    const eip712 = fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
    const signature = await signer.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      eip712.message,
    );

    console.log(`Encrypted Balance of ${userAddress} in token ${tokenaddress} is`, encryptedBalance.toString());

    const result = await fhevm.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      signer.address,
      startTimeStamp,
      durationDays,
    );

    const decryptedBalance = result[encryptedBalance.toString()];
    console.log(`Decrypted Balance of ${userAddress} in token ${tokenaddress} is`, decryptedBalance.toString());
  });
