// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChitEscrow
 * @dev Manages rotating savings pool deposits and bidding awards on Polygon.
 */
contract ChitEscrow {
    address public admin;
    uint256 public totalCircles;

    struct ChitCircle {
        uint256 id;
        uint256 totalPoolSize;
        uint256 membersCount;
        uint256 currentCycle;
        bool active;
    }

    mapping(uint256 => ChitCircle) public circles;

    event CircleCreated(uint256 indexed circleId, uint256 totalPoolSize);
    event BiddingCompleted(uint256 indexed circleId, address indexed winner, uint256 winningBid);

    constructor() {
        admin = msg.sender;
    }

    function createCircle(uint256 _circleId, uint256 _totalPoolSize) external {
        require(circles[_circleId].id == 0, "Circle already exists");
        circles[_circleId] = ChitCircle({
            id: _circleId,
            totalPoolSize: _totalPoolSize,
            membersCount: 0,
            currentCycle: 1,
            active: true
        });
        totalCircles++;
        emit CircleCreated(_circleId, _totalPoolSize);
    }
}
