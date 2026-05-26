// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChitEscrow
 * @notice On-chain escrow for SafeKosh chit fund groups.
 *         Manages group lifecycle: creation → collection → auction → settlement.
 * @dev    Deployed on Polygon Mumbai / Amoy testnet.
 */
contract ChitEscrow is ReentrancyGuard, Ownable {

    enum CycleStatus { Pending, Collection, Auction, Settling, Completed, Cancelled }

    struct Group {
        bytes32 groupId;
        address organiser;
        uint256 memberCount;
        uint256 durationCycles;
        uint256 currentCycle;
        bool active;
        uint256 createdAt;
    }

    struct Cycle {
        uint256 cycleNumber;
        uint256 potAmount;
        uint256 collectedAmount;
        uint256 auctionCloseTime;
        address winner;
        uint256 winningBid;
        uint256 winnerReceives;
        uint256 organiserCommission;
        uint256 dividendPerMember;
        CycleStatus status;
        bytes32 settlementHash;
    }

    // ── Storage ──────────────────────────────────────────────────────────────
    mapping(bytes32 => Group) public groups;
    mapping(bytes32 => mapping(uint256 => Cycle)) public cycles;
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasContributed;
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public bids;
    mapping(bytes32 => mapping(uint256 => address[])) public bidders;

    // ── Events ───────────────────────────────────────────────────────────────
    event GroupCreated(bytes32 indexed groupId, address organiser, uint256 memberCount);
    event FundsDeposited(bytes32 indexed groupId, uint256 indexed cycleNumber, address member, uint256 amount);
    event AuctionOpened(bytes32 indexed groupId, uint256 indexed cycleNumber, uint256 closeTime);
    event BidPlaced(bytes32 indexed groupId, uint256 indexed cycleNumber, address bidder, uint256 amount);
    event CycleSettled(bytes32 indexed groupId, uint256 indexed cycleNumber, address winner, uint256 winnerReceives, uint256 dividendPerMember);
    event GroupCompleted(bytes32 indexed groupId);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOrganiser(bytes32 groupId) {
        require(groups[groupId].organiser == msg.sender, "Not organiser");
        _;
    }

    modifier groupActive(bytes32 groupId) {
        require(groups[groupId].active, "Group not active");
        _;
    }

    // ── Group Lifecycle ──────────────────────────────────────────────────────

    /**
     * @notice Register a new chit group on-chain.
     * @param groupId      Unique identifier (keccak256 of off-chain UUID)
     * @param memberCount  Number of members (5–50)
     * @param durationCycles Total auction cycles the group will run
     */
    function createGroup(
        bytes32 groupId,
        uint256 memberCount,
        uint256 durationCycles
    ) external {
        require(groups[groupId].organiser == address(0), "Group exists");
        require(memberCount >= 5 && memberCount <= 50, "Invalid member count");

        groups[groupId] = Group({
            groupId: groupId,
            organiser: msg.sender,
            memberCount: memberCount,
            durationCycles: durationCycles,
            currentCycle: 0,
            active: true,
            createdAt: block.timestamp
        });

        emit GroupCreated(groupId, msg.sender, memberCount);
    }

    /**
     * @notice Initialise a new cycle for collection.
     */
    function initCycle(bytes32 groupId, uint256 cycleNumber, uint256 potAmount)
        external onlyOrganiser(groupId) groupActive(groupId)
    {
        cycles[groupId][cycleNumber] = Cycle({
            cycleNumber: cycleNumber,
            potAmount: potAmount,
            collectedAmount: 0,
            auctionCloseTime: 0,
            winner: address(0),
            winningBid: 0,
            winnerReceives: 0,
            organiserCommission: 0,
            dividendPerMember: 0,
            status: CycleStatus.Collection,
            settlementHash: bytes32(0)
        });
    }

    // ── Fund Collection ──────────────────────────────────────────────────────

    /**
     * @notice Members deposit their monthly contribution.
     */
    function depositFunds(bytes32 groupId, uint256 cycleNumber)
        external payable nonReentrant groupActive(groupId)
    {
        require(cycles[groupId][cycleNumber].status == CycleStatus.Collection, "Not in collection");
        require(!hasContributed[groupId][cycleNumber][msg.sender], "Already contributed");
        require(msg.value > 0, "Zero amount");

        hasContributed[groupId][cycleNumber][msg.sender] = true;
        cycles[groupId][cycleNumber].collectedAmount += msg.value;

        emit FundsDeposited(groupId, cycleNumber, msg.sender, msg.value);
    }

    // ── Auction ──────────────────────────────────────────────────────────────

    /**
     * @notice Organiser opens the auction window.
     */
    function openAuction(bytes32 groupId, uint256 cycleNumber, uint256 durationSeconds)
        external onlyOrganiser(groupId) groupActive(groupId)
    {
        Cycle storage c = cycles[groupId][cycleNumber];
        require(c.status == CycleStatus.Collection, "Not in collection");

        c.status = CycleStatus.Auction;
        c.auctionCloseTime = block.timestamp + durationSeconds;

        emit AuctionOpened(groupId, cycleNumber, c.auctionCloseTime);
    }

    /**
     * @notice Members place a bid (the amount they are willing to accept from the pot).
     *         Lower bid = higher discount = more dividend for others.
     *         Bid must be 70–100% of pot to prevent exploitative underbidding.
     */
    function placeBid(bytes32 groupId, uint256 cycleNumber, uint256 bidAmount)
        external groupActive(groupId)
    {
        Cycle storage c = cycles[groupId][cycleNumber];
        require(c.status == CycleStatus.Auction, "Not in auction");
        require(block.timestamp < c.auctionCloseTime, "Auction closed");
        require(bidAmount <= c.potAmount, "Bid exceeds pot");
        require(bidAmount >= (c.potAmount * 70) / 100, "Bid below 70% of pot");

        if (bids[groupId][cycleNumber][msg.sender] == 0) {
            bidders[groupId][cycleNumber].push(msg.sender);
        }
        bids[groupId][cycleNumber][msg.sender] = bidAmount;

        emit BidPlaced(groupId, cycleNumber, msg.sender, bidAmount);
    }

    // ── Settlement ───────────────────────────────────────────────────────────

    /**
     * @notice Organiser settles the cycle — disburses pot to winner, commission to organiser.
     */
    function settleCycle(
        bytes32 groupId,
        uint256 cycleNumber,
        address winner,
        uint256 winnerReceives,
        uint256 organiserCommission,
        uint256 dividendPerMember,
        bytes32 settlementHash
    ) external onlyOrganiser(groupId) nonReentrant groupActive(groupId) {
        Cycle storage c = cycles[groupId][cycleNumber];
        require(c.status == CycleStatus.Auction, "Not in auction");
        require(block.timestamp >= c.auctionCloseTime, "Auction still open");

        c.winner = winner;
        c.winnerReceives = winnerReceives;
        c.organiserCommission = organiserCommission;
        c.dividendPerMember = dividendPerMember;
        c.settlementHash = settlementHash;
        c.status = CycleStatus.Completed;

        // Transfer funds
        payable(winner).transfer(winnerReceives);
        payable(groups[groupId].organiser).transfer(organiserCommission);

        // Advance cycle counter
        groups[groupId].currentCycle = cycleNumber + 1;

        // Auto-complete group if all cycles done
        if (cycleNumber >= groups[groupId].durationCycles) {
            groups[groupId].active = false;
            emit GroupCompleted(groupId);
        }

        emit CycleSettled(groupId, cycleNumber, winner, winnerReceives, dividendPerMember);
    }

    // ── View Functions ───────────────────────────────────────────────────────

    function getGroup(bytes32 groupId) external view returns (Group memory) {
        return groups[groupId];
    }

    function getCycle(bytes32 groupId, uint256 cycleNumber) external view returns (Cycle memory) {
        return cycles[groupId][cycleNumber];
    }
}
