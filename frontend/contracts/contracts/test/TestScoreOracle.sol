// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TestScoreOracle {
    mapping(address => uint16) public scores;
    mapping(address => uint32) public timestamps;

    function setScore(address agent, uint16 score) external {
        scores[agent] = score;
        timestamps[agent] = uint32(block.timestamp);
    }

    function getScore(address agent) external view returns (uint16, uint32) {
        return (scores[agent], timestamps[agent]);
    }
}
