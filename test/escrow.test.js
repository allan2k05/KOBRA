const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow - ClearNode settlement", function () {
  it("accepts deposits and settles when provided a valid ClearNode signature", async function () {
    const [owner, player1, player2, clearNodeSigner] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(clearNodeSigner.address);
    await escrow.deployed();

    const matchId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("match-1"));

    // Players deposit into the match
    await escrow.connect(player1).depositForMatch(matchId, { value: ethers.utils.parseEther("1") });
    await escrow.connect(player2).depositForMatch(matchId, { value: ethers.utils.parseEther("2") });

    const winner = player2.address;

    // Create the same message hash the contract expects: keccak256(abi.encodePacked(matchId, winner))
    const msgHash = ethers.utils.solidityKeccak256(["bytes32", "address"], [matchId, winner]);
    // Sign the 32-byte hash using the ClearNode signer (produces an Ethereum Signed Message signature)
    const signature = await clearNodeSigner.signMessage(ethers.utils.arrayify(msgHash));

    const winnerBalanceBefore = await ethers.provider.getBalance(winner);

    // Call settle
    const tx = await escrow.connect(owner).settle(matchId, winner, signature);
    await tx.wait();

    expect(await escrow.isSettled(matchId)).to.equal(true);

    const winnerBalanceAfter = await ethers.provider.getBalance(winner);
    // Payout should equal 3 ETH; winner balance must increase by approx that amount
    expect(winnerBalanceAfter).to.be.above(winnerBalanceBefore);
  });
});
