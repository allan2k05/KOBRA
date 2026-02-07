const hre = require("hardhat");

async function main() {
  // ClearNode signer address — set via env or use deployer as default
  const [deployer] = await hre.ethers.getSigners();
  const clearNodeSigner = process.env.CLEARNODE_SIGNER || deployer.address;

  console.log("Deploying with ClearNode signer:", clearNodeSigner);

  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(clearNodeSigner);

  await escrow.deployed();

  console.log("Escrow contract deployed to:", escrow.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });