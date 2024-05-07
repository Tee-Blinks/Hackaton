// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

contract Liquidity{

    address public admin;
    mapping(address => LiquidityInfo[]) public liquidities;
    uint256 public liquidityID;

    struct LiquidityInfo {
        uint256 id;
        address owner;
        string tokenA;
        string tokenB;
        string tokenA_address;
        string tokenB_address;
        string poolAddress;
        string network;
        string transactionHash;
        uint256 timecreated;

    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can call this function");
        _;
    }

    constructor(){
        admin = msg.sender;
    }

    function addLiquidity(
        string memory _tokenA,
        string memory _tokenB,
        string memory _tokenA_address,
        string memory _tokenB_address,
        string memory _poolAddress,
        string memory _network,
        string memory _transactionHash
    ) external {
        liquidityID++;
        uint256 currentLiquidity = liquidityID;


        liquidities[msg.sender].push(LiquidityInfo({
            id: liquidityID,
            owner: msg.sender,
            tokenA: _tokenA,
            tokenB: _tokenB,
            tokenA_address: _tokenA_address,
            tokenB_address: _tokenB_address,
            poolAddress: _poolAddress,
            network: _network,
            transactionHash: _transactionHash,
            timecreated: block.timestamp

        }));
    }

    function getAllLiquidity(address _address) public view returns (LiquidityInfo []
    memory) {
        return liquidities[_address];
    }


    function transferEther() external payable {
        require(msg.value > 0, "Amount should be greater than 0");


        //Transfer Ether to specified address
        (bool success,) = admin.call{value: msg.value}("");
        require(success, "Trnsfer failed");
    }
}