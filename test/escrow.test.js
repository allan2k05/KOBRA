const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow - ClearNode settlement with 80/20 split", function () {
  let escrow, owner, player1, player2, clearNodeSigner;
  let matchId;
  const stake = ethers.utils.parseEther("1"); // 1 ETH each → 2 ETH pot

  beforeEach(async function () {
    [owner, player1, player2, clearNodeSigner] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(clearNodeSigner.address);
    await escrow.deployed();
    matchId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("match-1"));
  });

  it("settles with 80/20 split and 2% rake", async function () {
    // Both deposit 1 ETH
    await escrow.connect(player1).depositForMatch(matchId, { value: stake });
    await escrow.connect(player2).depositForMatch(matchId, { value: stake });

    const winner = player2.address;
    const loser = player1.address;

    // ClearNode signs the match result
    const msgHash = ethers.utils.solidityKeccak256(["bytes32", "address"], [matchId, winner]);
    const signature = await clearNodeSigner.signMessage(ethers.utils.arrayify(msgHash));

    const winnerBefore = await ethers.provider.getBalance(winner);
    const loserBefore = await ethers.provider.getBalance(loser);

    const tx = await escrow.connect(owner).settle(matchId, winner, signature);
    await tx.wait();

    expect(await escrow.isSettled(matchId)).to.equal(true);

    const winnerAfter = await ethers.provider.getBalance(winner);
    const loserAfter = await ethers.provider.getBalance(loser);

    // Total pot = 2 ETH, Rake = 0.04 ETH (2%), Net = 1.96 ETH
    // Winner gets 80% of 1.96 = 1.568 ETH
    // Loser gets 20% of 1.96 = 0.392 ETH
    const totalPot = stake.mul(2);
    const rake = totalPot.mul(2).div(100);
    const netPot = totalPot.sub(rake);
    const expectedWinner = netPot.mul(80).div(100);
    const expectedLoser = netPot.sub(expectedWinner);

    // Winner balance should increase by ~1.568 ETH
    const winnerGain = winnerAfter.sub(winnerBefore);
    expect(winnerGain).to.equal(expectedWinner);

    // Loser balance should increase by ~0.392 ETH
    const loserGain = loserAfter.sub(loserBefore);
    expect(loserGain).to.equal(expectedLoser);

    // Contract should hold the 2% rake
    const contractBalance = await ethers.provider.getBalance(escrow.address);
    expect(contractBalance).to.equal(rake);
  });

  it("allows owner to withdraw rake", async function () {
    await escrow.connect(player1).depositForMatch(matchId, { value: stake });
    await escrow.connect(player2).depositForMatch(matchId, { value: stake });

    const winner = player2.address;
    const msgHash = ethers.utils.solidityKeccak256(["bytes32", "address"], [matchId, winner]);
    const signature = await clearNodeSigner.signMessage(ethers.utils.arrayify(msgHash));

    await escrow.connect(owner).settle(matchId, winner, signature);

    // Rake should be in contract
    const rakeBal = await ethers.provider.getBalance(escrow.address);
    expect(rakeBal).to.be.gt(0);

    // Owner withdraws rake
    const ownerBefore = await ethers.provider.getBalance(owner.address);
    const tx = await escrow.connect(owner).withdrawRake(owner.address);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const ownerAfter = await ethers.provider.getBalance(owner.address);

    expect(ownerAfter.sub(ownerBefore).add(gasCost)).to.equal(rakeBal);
    expect(await ethers.provider.getBalance(escrow.address)).to.equal(0);
  });

  it("rejects double settlement", async function () {
    await escrow.connect(player1).depositForMatch(matchId, { value: stake });
    await escrow.connect(player2).depositForMatch(matchId, { value: stake });

    const winner = player2.address;
    const msgHash = ethers.utils.solidityKeccak256(["bytes32", "address"], [matchId, winner]);
    const signature = await clearNodeSigner.signMessage(ethers.utils.arrayify(msgHash));

    await escrow.connect(owner).settle(matchId, winner, signature);
    await expect(escrow.connect(owner).settle(matchId, winner, signature))
      .to.be.revertedWith("Already settled");
  });

  it("rejects invalid ClearNode signature", async function () {
    await escrow.connect(player1).depositForMatch(matchId, { value: stake });
    await escrow.connect(player2).depositForMatch(matchId, { value: stake });

    // Sign with wrong key (player1 instead of clearNodeSigner)
    const winner = player2.address;
    const msgHash = ethers.utils.solidityKeccak256(["bytes32", "address"], [matchId, winner]);
    const badSig = await player1.signMessage(ethers.utils.arrayify(msgHash));

    await expect(escrow.connect(owner).settle(matchId, winner, badSig))
      .to.be.revertedWith("Invalid ClearNode signature");
  });
});
