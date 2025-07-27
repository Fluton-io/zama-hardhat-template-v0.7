import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { sleep } from "../utils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const { deploy } = hre.deployments;

  console.log(deployer, chainId);

  const deployed = await deploy("FHEVMBridge", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(`FHEVMBridge contract: `, deployed.address);

  const verificationArgs = {
    address: deployed.address,
    contract: "contracts/FHEVMBridge.sol:FHEVMBridge",
    constructorArguments: [],
  };

  console.info("\nSubmitting verification request on Etherscan...");
  await sleep(30000); // wait for etherscan to index the contract
  await hre.run("verify:verify", verificationArgs);
};

export default func;
func.id = "deploy_FHEVMBridge"; // id required to prevent reexecution
func.tags = ["FHEVMBridge"];
