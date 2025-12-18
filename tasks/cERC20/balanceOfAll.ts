import { task } from "hardhat/config";
import addresses from "../../config/addresses";
import { CERC20 } from "../../types";

task("balanceOfAll", "Get all user balance")
  .addOptionalParam("signeraddress", "The address of the signer")
  .addOptionalParam("useraddress", "The address of the user")
  .setAction(async ({ signeraddress, useraddress }, hre) => {
    const { ethers, getChainId, getNamedAccounts, fhevm } = hre;
    const chainId = await getChainId();
    const userAddress = useraddress || (await getNamedAccounts()).user;
    const signerAddress = signeraddress || (await getNamedAccounts()).user;
    const signer = await ethers.getSigner(signerAddress);

    if (!addresses[+chainId]) {
      throw new Error("Chain ID not supported");
    }

    const tokenAddresses = [
      addresses[+chainId].cUSDC,
      addresses[+chainId].cUSDT,
      addresses[+chainId].cDAI,
      addresses[+chainId].cUNI,
      addresses[+chainId].cU,
      addresses[+chainId].cXFL,
      addresses[+chainId].cAAVE,
    ];

    const encryptedBalances = await Promise.all(
      tokenAddresses.map(async (tokenaddress) => {
        const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;
        const encryptedBalance = await tokenContract.confidentialBalanceOf(userAddress);
        return { tokenaddress, encryptedBalance };
      }),
    );

    await fhevm.initializeCLIApi();

    const keypair = fhevm.generateKeypair();
    const handleContractPairs = encryptedBalances.map(({ tokenaddress, encryptedBalance }) => ({
      handle: encryptedBalance,
      contractAddress: tokenaddress,
    }));
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // String for consistency
    const contractAddresses = encryptedBalances.map(({ tokenaddress }) => tokenaddress);

    const eip712 = fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
    const signature = await signer.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      eip712.message,
    );

    encryptedBalances.forEach(({ tokenaddress, encryptedBalance }) => {
      console.log(`Encrypted Balance of ${userAddress} in token ${tokenaddress} is`, encryptedBalance.toString());
    });
    console.log(keypair.publicKey);
    console.log("Signature:", signature);

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

    encryptedBalances.forEach(({ tokenaddress, encryptedBalance }) => {
      const decryptedBalance = result[encryptedBalance.toString()];
      console.log(`Decrypted Balance of ${userAddress} in token ${tokenaddress} is`, decryptedBalance.toString());
    });
  });
