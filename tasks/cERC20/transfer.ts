import { task } from "hardhat/config";
import { createInstance, FhevmInstanceConfig, MainnetConfig } from "@zama-fhe/relayer-sdk/node";
import addresses from "../../config/addresses";
import { CERC20 } from "../../types";

task("transfer", "Transfer cERC20 tokens from user address to another")
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
      tokenaddress = addresses[+chainId].cUSDC; // Default to deployed
    }

    if (!to) {
      to = (await getNamedAccounts()).relayer; // Default to relayer address
    }

    if (!from) {
      from = signer.address; // Default to signer address
    }

    const tokenContract = (await ethers.getContractAt("cERC20", tokenaddress, signer)) as unknown as CERC20;

    const config: FhevmInstanceConfig = {
      ...MainnetConfig,
      network: "https://mainnet.infura.io/v3/5614c116efd34f94a3679f8219cb4cd0",
    };
    const zamaClient = await createInstance(config);

    const encryptedAmount = await zamaClient.createEncryptedInput(tokenaddress, signerAddress).add64(+amount).encrypt();
    await tokenContract["confidentialTransferFrom(address,address,bytes32,bytes)"](
      from,
      to,
      encryptedAmount.handles[0],
      encryptedAmount.inputProof,
    );

    console.log(`Transferred ${amount} cERC20 tokens from ${from} to ${to} using token ${tokenaddress}`);
  });
