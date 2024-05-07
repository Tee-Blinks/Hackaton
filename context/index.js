import React, { useState, useEffect, createContext } from "react";
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import axios from "axios";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import toast from "react-hot-toast";


import {Token} from "@uniswap/sdk-core"
import {Pool, Position, nearestUsableTick } from "@uniswap/v3-sdk";
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import {abi as INonfungiblePositionManagerABI} from "@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
import ERC20ABI from "./abi.json";

import {
  CONNECTING_CONTRACT,
  V3_SWAP_ROUTER_ADDRESS,
  FACTORY_ABI,
  FACTORY_ADDRESS,
  web3Modal,
  PositionManagerAddress,
  internalDltContract,
  internalAfricaContract,
  internalLiquidityContract,
  getBalance,
  web3Provider,
  internalAddLiquidity,
} from "./constants";
import { parseErrMsg } from "../Utils/index";

export const CONTEXT = createContext();

export const CONTEXT_Provider = ({ children }) => {
  const [loader, setLoader] = useState(false);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState();
  const [balance, setBalance] = useState();
  const [nativeToken, setNativeToken] = useState();
  const [tokenHolders, setTokenHolders] = useState([]);
  const [tokenSale, setTokenSale] = useState();
  const [currentHolder, setCurrentHolder] = useState();

  const notifyError = (msg) => toast.error(msg, { duration: 4000 });
  const notifySuccess = (msg) => toast.success(msg, { duration: 4000 });

  const connect = async () => {
    try {
      if (!window.ethereum) return notifyError("Please Install Metamask");

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      if (accounts.length) {
        setAddress(accounts[0])
      } else {
        notifyError("Sorry, you have no account")
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(network.chainId);
    } catch (error) {
      const errorMsg = parseErrMsg(error);
      notifyError(errorMsg);
      console.log(error);
    }
  };

  const checkIfWalletConnected = async () => {
    const accounts = await window.ethereum.request({
      method: "eth_accounts"
    });

    return accounts[0];
  };

  const LOAD_TOKEN = async (token) => {
    try {
      const tokenDetails = await CONNECTING_CONTRACT(token);
      return tokenDetails;
    } catch (error) {
      console.log(error);
    }
  };

  const GET_POOL_ADDRESS = async (token_1, token_2, fee) => {
    try {
      setLoader(true);
      const PROVIDER = await web3Provider();

      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        FACTORY_ABI,
        PROVIDER
      );

      const poolAddress = await factoryContract.functions.getPool(
        token_1.address,
        token_2.address,
        Number(fee)
      );

      const poolHistory = {
        token_A: token_1,
        token_B: token_2,
        fee: fee,
        network: token_1.chainId,
        poolAddress: poolAddress,
      };

      const zeroAdd = "0x0000000000000000000000000000000000000000";

      if (poolAddress == zeroAdd) {
        notifySuccess("Sorry there is no pool");
      } else {
        let PoolArray = [];
        const PoolLists = localStorage.getItem("poolHistory");
        if (PoolLists) {
          PoolArray = JSON.parse(localStorage.getItem("poolHistory"));
          PoolArray.push(poolHistory);
          localStorage.setItem("poolHistory", JSON.stringify(PoolArray));
        } else {
          PoolArray.push(poolHistory);
          localStorage.setItem("poolHistory", JSON.stringify(PoolArray));
        }

        setLoader(false);
        notifySuccess("Successfully Completed");
      }

      return poolAddress;
    } catch (error) {
      const errorMsg = parseErrMsg(error);
      setLoader(false);
      notifyError(errorMsg);
    }
  };

  async function getPoolData(poolContract) {
    const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
      poolContract.tickSpacing(),
      poolContract.fee(),
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    return {
      tickSpacing: tickSpacing,
      fee: fee,
      liquidity: liquidity,
      sqrtPriceX96: slot0[0],
      tick: slot0[1],
    };
  }

  const CREATE_LIQUIDITY = async (pool, liquidityAmount, approveAmount) => {
    try {
      setLoader(true);
      const address = await checkIfWalletConnected();
      const PROVIDER = await web3Provider();
      const signer = PROVIDER.getSigner();

      const TOKEN_1 = new Token(
        pool.token_A.chainId,
        pool.token_A.address,
        pool.token_A.decimals,
        pool.token_A.symbol,
        pool.token_A.name
      );

      const TOKEN_2 = new Token(
        pool.token_B.chainId,
        pool.token_B.address,
        pool.token_B.decimals,
        pool.token_B.symbol,
        pool.token_B.name
      );

      const poolAddress = pool.poolAddress[0];

      const nonfungiblePositionManagerContract = new ethers.Contract(
        PositionManagerAddress,
        IUniswapV3PoolABI,
        PROVIDER
      );

      const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI,
        PROVIDER
      );

      const poolData = await getPoolData(poolContract);

      const Token_1_TOKEN_2 = new Token(
        TOKEN_1,
        TOKEN_2,
        poolData.fee,
        poolData.sqrtPriceX96.toString(),
        poolData.liquidity.toString(),
        poolData.tick
      );

      const position = new Position({
        pool: Token_1_TOKEN_2,
        liquidity: ethers.utils.parseUnits(liquidityAmount, 18),
        tickLower:
          nearestUsableTick(poolData.tick, poolData.tickSpacing) -
          poolData.tickSpacing * 2,
        tickUpper:
          nearestUsableTick(poolData.tick, poolData.tickSpacing) +
          poolData.tickSpacing * 2,
      });

      const approvalAmount = ethers.utils
        .parseUnits(approveAmount, 18)
        .toString();
      const tokenContract0 = new ethers.Contract(
        poolAddress,
        ERC20ABI,
        PROVIDER
      );
      await tokenContract0
        .connect(signer)
        .approve(positionManagerAddress, approvalAmount);

      const tokenContract1 = new ethers.Contract(
        poolAddress,
        ERC20ABI,
        PROVIDER
      );
      await tokenContract1
        .connect(signer)
        .approve(positionManagerAddress, approvalAmount);

      const { amount0: amount0Desired, amount1: amount1Desired } =
        position.mintAmounts;

      const params = {
        token0: pool.token_A.address,
        token1: pool.token_B.address,
        fee: pool.fee,
        tickLower:
          nearestUsableTick(poolData.tick, poolData.tickSpacing) -
          poolData.tickSpacing * 2,
        tickUpper:
          nearestUsableTick(poolData.tick, poolData.tickSpacing) +
          poolData.tickSpacing * 2,
        amount0Desired: amount0Desired.toString(),
        amount1Desired: amount1Desired.toString(),
        amount0Min: amount0Min.toString(),
        amount1Min: amount1Min.toString(),
        recipient: address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 10,
      };

      const transactionHash = await nonfungiblePositionManagerContract
        .connect(signer)
        .mint(params, { gasLimit: ethers.utils.hexlify(1000000) })
        .then((res) => {
          return res.hash;
        });

      if (transactionHash) {
        const liquidityContract = await internalAddLiquidity();

        const addLiquidityData = await liquidityContract
          .connect(signer)
          .addLiquidity(
            pool.token_A.name,
            pool.token_B.name,
            pool.token_A.address,
            pool.token_B.address,
            poolAddress,
            pool.token_B.chainId.toString(),
            transactionHash
          );
        await addLiquidityData.await();

        setLoader(false);
        notifySuccess("Liquidity added successfully");
        window.location.reload();
      }
    } catch (error) {
      const errMsg = parseErrMsg(error);
      setLoader(false);
      notifyError(errMsg);
    }
  };

  const fetchInitialData = async () => {
    try {
      const account = await checkIfWalletConnected();
      const balance = await getBalance();

      setBalance(ethers.utils.formatEther(balance.toString()));
      setAddress(account);

      const DLT_TOKEN_CONTRACT = await internalDltContract();

      let tokenBalance;
      if (account) {
        tokenBalance = await DLT_TOKEN_CONTRACT.getBalance(account);
      } else {
        tokenBalance = 0;
      }

      const tokenName = await DLT_TOKEN_CONTRACT.name();
      const tokenSymbl = await DLT_TOKEN_CONTRACT.symbols();
      const tokeTotalSupply = await DLT_TOKEN_CONTRACT.totalSupply();
      const tokenStandard = await DLT_TOKEN_CONTRACT.standard();
      const tokenHolders = await DLT_TOKEN_CONTRACT._userId();
      const tokenOwnerOfCOntract = await DLT_TOKEN_CONTRACT.ownerOfContract();
      const tokenAddress = await DLT_TOKEN_CONTRACT.address;

      const nativeToken = {
        tokenAddress: tokenAddress,
        tokenName: tokenName,
        tokenSymbols: tokenSymbl,
        tokenOwnerOfCOntract: tokenOwnerOfCOntract,
        tokenStandard: tokenStandard,
        tokenTotalSupply: ethers.utils.formatEther(tokenTotalSupply.toString()),
        tokenBalance: ethers.utils.formatEther(tokenBalance.toString()),
        tokenHolders: tokenHolders.toNumber(),
      };

      setNativeToken(nativeToken);

      const getTokenHolder = await DLT_TOKEN_CONTRACT.getTokenHolders();
      setTokenHolders(getTokenHolder);

      if (account) {
        const getTokenHolderData = await DLT_TOKEN_CONTRACT.getTokenHolderData(
          account
        );

        const currentHolder = {
          tokenId: getTokenHolderData[0].toNumber(),
          from: getTokenHolderData[1],
          toastId: getTokenHolderData[2],
          totalToken: ethers.utils.formatEther(
            getTokenHolderData[3].toString()
          ),
          tokenHOlder: getTokenHolderData[4],
        };
        setCurrentHolder(currentHolder);
      }

      const AFRICA_CONTRACT = await internalAfricaContract();
      const tokenPrice = await AFRICA_CONTRACT.tokenPrice();
      const tokenSold = await AFRICA_CONTRACT.tokenSold();
      const tokenSaleBalance = await AFRICA_CONTRACT.balanceOf(
        "0x117B8d82b60e3e646F80EFA7816e46471e54b799"
      );

      const tokenSale = {
        tokenPrice: ethers.utils.formatEther(tokenPrice.toString()),
        tokenSold: tokenSold.toNumber(),
        tokenSaleBalance: ethers.utils.formatEther(
          tokenSaleBalance.toString()
        ),
      };
      setTokenSale(tokenSale);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const buyToken = async (nToken) => {
    try {
      setLoader(true);
      const PROVIDER = await web3Provider();
      const signer = PROVIDER.getSigner();

      const contract = await internalAfricaContract();

      const price = 0.0001 * nToken;
      const amount = ethers.utils.parseUnits(price.toString(), "ether");

      const buying = await contract.connect(signer).buyTokens(nToken, {
        value: amount.toString(),
        gasLimit: ethers.utils.hexlify(1000000),
      });

      await buying.wait();
      window.location.reload();
    } catch (error) {
      const errMsg = parseErrMsg(error);
      console.log(error);
      setLoader(false);
      notifyError(errMsg);
    }
  };

  const transferNativeToken = async () => {
    try {
      setLoader(true);
      const PROVIDER = await web3Provider();
      const signer = PROVIDER.getSigner();

      const TOKEN_SALE_ADDRESS = "0x117B8d82b60e3e646F80EFA7816e46471e54b799";
      const TOKEN_AMOUNT = 2000;
      const tokens = TOKEN_AMOUNT.toString();
      const transferAmount = ethers.utils.parseEther(tokens);

      const contract = await internalDltContract();
      const transaction = await contract
        .connect(signer)
        .transfer(TOKEN_SALE_ADDRESS, transferAmount);

      await transaction.wait();

      window.location.reload();
    } catch (error) {
      const errorMsg = parseErrMsg(error);
      setLoader(false);
      notifyError(errorMsg);
    }
  };

  const GET_ALL_LIQUIDITY = async () => {
    try {
      const account = await checkIfWalletConnected();

      const contract = internalAddLiquidity();
      const liquidityHistory = await contract.getAllLiquidity(account);

      const Allliquidity = liquidityHistory.map((liquidity) => {
        const liquidityArray = {
          id: liquidity.id.toNumber(),
          network: liquidity.network,
          owner: liquidity.owner,
          poolAddress: liquidity.poolAddress,
          tokenA: liquidity.tokenA,
          tokenB: liquidity.tokenB,
          tokenA_Address: liquidity.tokenA_Address,
          tokenB_Address: liquidity.tokenB_Address,
          timeCreated: liquidity.timeCreated.toNumber(),
          transactionHash: liquidity.transactionHash,
        };
        return liquidityArray;
      });
      return Allliquidity;
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <CONTEXT.Provider
      value={{
        connect,
        GET_POOL_ADDRESS,
        LOAD_TOKEN,
        notifyError,
        notifySuccess,
        CREATE_LIQUIDITY,
        GET_ALL_LIQUIDITY,
        transferNativeToken,
        buyToken,
        tokenSale,
        nativeToken,
        address,
        loader,
        DAPP_Name: "Liquidity Dapp",
      }}
    >
      {children}
    </CONTEXT.Provider>
  );
};




// import React, {useState, useEffect} from "react";
// import {ethers, Contract} from "ethers";
// import Web3Modal from "web3modal";
// import axios from "axios";
// import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
// import toast from "react-hot-toast";

// import  {Token} from "@uniswap/sdk-core";
// import { Pool, Position, nearestUsableTick  } from "@uniswap/v3-sdk";
// import {abi as IUniswapV3PoolABI} from "@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json"
// import {abi as INonfungiblePositionManagerABI} from "@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
// import ERC20ABI from "./abi.json";

// //INTERNAL IMPORT
// import {
//     TOKEN_ABI,
//     V3_SWAP_ROUTER_ADDRESS,
//     CONNECTING_CONTRACT,
//     FACTORY_ABI,
//     FACTORY_ADDRESS,
//     web3Modal,
//     PositionManagerAddress,
//     internalDltContract,
//     internalAfricaContract,
//     internalLiquidityContract,
//     getBalance,
//     web3Provider,
//     positionManagerAddress,
//     internalAddLiquidity,
// }from "./constants";
// import {parseErrMsg} from "../Utils/index";
// import { network } from "hardhat";

// export const CONTEXT = React.createClass();

// export const CONTEXT_Provider = ({children}) => {
//     const DAPP_Name = "Liquidity Dapp";
//     const [loader, setLoader] = useState(false);
//     const [address, setAddress] = useState("");
//     const [chainId, setChainId] = useState();
//     //TOKEN

//     const [balance, setBalance] = useState();
//     const [nativeToken, setNativeToken] = useState();
//     const [tokenHolders, setTokenHolders] = useState([]);
//     const [tokenSale, setTokenSale] = useState();
//     const [currentHolder, setCurrentHolder] = useState()
    
    

//     //NOTIFICATION
//     const notifyError = (msg) => toast.error(msg, {duration: 4000});
//     const notifySucccess = (msg) => toast.error(msg, {duration: 4000});


//     //CONNECT WALLET
//     const connect = async () => {
//         try{
//             if (!window.ethereum) return notifyError("Please Install Metamask");

//             const accounts = await window.ethereum.request({
//                 method: "eth_requestAccounts"
//             });

//             if (accounts.length) {
//                 setAddress(accounts[0])
//             } else {
//                 notifyError("Sorry, you have no account")
//             }

//             const provider = new ethers.providers.Web3Provider(window.ethereum);
//             const network = await provider.getNetwork();
//             setChainId(network.chainId);
//         } catch (error) {
//             const errorMsg = parseErrMsg(error);
//             notifyError(errorMsg);
//             console.log(error);
//         }
//     };

//     //CHECK IF WALLET IS CONNECTED
//     const checkIfWalletConnected = async () => {
//         const accounts = await window.ethereum.request({
//             method: "eth_accounts"
//         });

//         return accounts[0]
//     };

//     const LOAD_TOKEN = async (token) => {
//     try{
//         const tokenDetails = await CONNECTING_CONTRACT(token);
//         return tokenDetails;
//     } catch (error){
//         console.log(error);
//     }
// };

    
//     //GET POOL ADDRESS
//     const GET_POOL_ADDRESS = async (token_1, token_2, fee) => {
//         try{
//             setLoader(true);
//             const PROVIDER = await web3Provider();


//             const factoryContract = new ethers.Contract(
//                 FACTORY_ADDRESS,
//                 FACTORY_ABI,
//                 PROVIDER
//             );


//             const poolAddress = await factoryContract.functions.getPool(
//                 token_1.address,
//                 token_2.address,
//                 Number(fee)
//             );

//             const poolHistory = {
//                 token_A: token_1,
//                 token_B: token_2,
//                 fee: fee,
//                 network: token_1.chainId,
//                 poolAddress: poolAddress,

//             };

//             const zeroAdd = "0x0000000000000000000000000000000000000000"

//             if(poolAddress == zeroAdd) {
//                 notifySucccess("Sorry there is no pool");

//             } else {
//                 let PoolArray = [];
//                 const PoolLists = localStorage.getItem("poolHistory");
//                 if (PoolLists){
//                     PoolArray = JSON.parse(localStorage.getItem("poolHistory"));
//                     PoolArray.push(poolHistory);
//                     localStorage.setItem("poolHistory", JSON.stringify(PoolArray));
//                 } else {
//                     PoolArray.push(poolHistory);
//                     localStorage.setItem("poolHistory", JSON.stringify(PoolArray));
//                 }

//                 setLoader(false);
//                 notifySucccess("Successfully Completed")
//             }

//             return poolAddress;
//         } catch(error) {
//             const errorMsg = parseErrorMsg(error);
//             setLoader(false);
//             notifyError(errorMsg);
//         }
//     }


//     // CREATE LIQUIDITY
//     async function getPoolData(poolContract) {
//         const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
//             poolContract.tickSpacing(),
//             poolContract.fee(),
//             poolContract.liquidity(),
//             poolContract.slot0(),

//         ]);

//         return{
//             tickSpacing: tickSpacing,
//             fee: fee,
//             liquidity: liquidity,
//             sqrtPriceX96: slot0[0],
//             tick: slot0[1],
//         };
//     }

//     const CREATE_LIQUIDITY = async (pool, liquidityAmount, approveAmount) =>{
//         try{
//             setLoader(true);
//             const address = await checkIfWalletConnected();
//             const PROVIDER = await web3Provider();
//             const signer = PROVIDER.getSigner();

//             const TOKEN_1 = new Token(
//                 pool.token_A.chainId,
//                 pool.token_A.address,
//                 pool.token_A.decimals,
//                 pool.token_A.symbol,
//                 pool.token_A.name
                
//             );

//             const TOKEN_2 = new Token(
//                 pool.token_B.chainId,
//                 pool.token_B.address,
//                 pool.token_B.decimals,
//                 pool.token_B.symbol,
//                 pool.token_B.name
//             );

//             const poolAddress = pool.poolAddress[0];

//             const nonfungiblePositionManagerContract = new ethers.Contract(
//                 PositionManagerAddress,
//                 INonfungiblePositionManagerABI,
//                 PROVIDER
//             );

//             const poolContract = new ethers.Contract(
//                 poolAddress,
//                 IUniswapV3PoolABI,
//                 PROVIDER
//             );

//             const poolData = await getPoolData(poolContract)

//             const Token_1_TOKEN_2 = new Token(
//                 TOKEN_1,
//                 TOKEN_2,
//                 poolData.fee,
//                 poolData.sqrtPriceX96.toString(),
//                 poolData.liquidity.toString(),
//                 poolData.tick
//             );

//             const position = new Position ({
//                 pool: Token_1_TOKEN_2,
//                 liquidity: ethers.utils.parseUnits(liquidityAmount, 18),
//                 tickLower:
//                 nearestUsableTick(poolData.tick, poolData.tickSpacing) -
//                 poolData.tickSpacing * 2,
//                 tickUpper:
//                 nearestUsableTick(poolData.tick, poolData.tickSpacing) +
//                 poolData.tickSpacing * 2,
//             })

//             const approvalAmount = ethers.utils
//             .parseUnits(approveAmount, 18)
//             .toString();
//             const tokenContract0 = new ethers.Contract(
//                 poolAddress,
//                 ERC20ABI,
//                 PROVIDER
//             );
//             await tokenContract0
//             .connect(signer)
//             .approve(positionManagerAddress, approvalAmount)

//             const tokenContract1 = new ethers.Contract(
//                 poolAddress,
//                 ERC20ABI,
//                 PROVIDER
//             );
//             await tokenContract1
//             .connect(signer)
//             .approve(positionManagerAddress, approvalAmount)

//             const {amount0: amount0Desired, amount1: amount1Desired} = 
//             position.mintAmounts;

//             //MINTAMOUNTWITHSLIPPAGE


//                 const params = {
//                     token0: pool.token_A.address,
//                     token1: pool.token_B.address,
//                     fee: pool.fee,
//                     tickLower:
//                     nearestUsableTick(poolData.tick, poolData.tickSpacing ) - 
//                     poolData.tickSpacing * 2,
//                     tickUpper:
//                     nearestUsableTick(poolData.tick,poolData.tickSpacing) +
//                     poolData.tickSpacing * 2,
//                     amount0Desired: amount0Desired.toString(),
//                     amount1Desired: amount1Desired.toString(),
//                     amount0Min: amount0Min.toString(),
//                     amount1Min: amount1Min.toString(),
//                     recipient: address,
//                     deadline: Math.floor(Date.now() / 1000) + 60 * 10,

//                 }

//                 const transactionHash = await nonfungiblePositionManagerContract
//                 .connect(signer)
//                 .mint(params, {gasLimit: ethers.utils.hexlify(1000000)})
//                 .then((res) => {
//                     return res.hash;
//                 });

//                 if(transactionHash) {
//                     const liquidityContract = await internalAddLiquidity();

//                     const addLiquidityData = await liquidityContract
//                     .connect(signer)
//                     .addLiquidity(
//                         pool.token_A.name,
//                         pool.token_B.name,
//                         pool.token_A.address,
//                         pool.token_B.address,
//                         poolAddress,
//                         pool.token_B.chainId.toString(),
//                         transactionHash
//                     );
//                     await addLiquidityData.await();

//                     setLoader(false);
//                     notifySucccess("Liquidity added successfully");
//                     window.location.reload();

//                 }

//         } catch(error) {
//             const errMsg = parseErrMsg(error)
//             setLoader(false);
//             notifyError(errMsg);
//         }
//     };

//     //NATIVE TOKEN
//     const fetchInitialData = async () => {
//         try{
//             // Get user account.
//             const account = await checkIfWalletConnected();
//             //Get User Balance
//             const balance = await getBalance();

//             setBalance(ethers.utils.formatEther(balance.toString()));
//         setAddress(account);

//         //DLT_TOKEN_CONTRACT
//         const DLT_TOKEN_CONTRACT = await internalDltContract();


//         let tokenBalance;
//         if(account) {
//             tokenBalance = await DLT_TOKEN_CONTRACT.getBalance(account);

//         } else {
//             tokenBalance = 0;
//         }

//         const tokenName = await DLT_TOKEN_CONTRACT.name();
//         const tokenSymbl = await DLT_TOKEN_CONTRACT.symbols();
//         const tokeTotalSupply = await  DLT_TOKEN_CONTRACT.totalSupply();
//         const tokenStandard = await DLT_TOKEN_CONTRACT.standard();
//         const tokenHolders = await DLT_TOKEN_CONTRACT._userId();
//         const tokenOwnerOfCOntract = await DLT_TOKEN_CONTRACT.ownerOfContract();
//         const tokenAddress = await DLT_TOKEN_CONTRACT.address;

//         const nativeToken = {
//             tokenAddress: tokenAddress,
//             tokenName: tokenName,
//             tokenSymbols: tokenSymbl,
//             tokenOwnerOfCOntract: tokenOwnerOfCOntract,
//             tokenStandard: tokenStandard,
//             tokenTotalSupply: ethers.utils.formatEther(tokenTotalSupply.toString()),
//             tokenBalance: ethers.utils.formatEther(tokenBalance.toString()),
//             tokenHolders: tokenHolders.toNumber(),

//         };

//         setNativeToken(nativeToken);

//         //GETTING TOKEN HOLDERS
//         const getTokenHolder = await DLT_TOKEN_CONTRACT.getTokenHolders();
//         setTokenHolders(getTokenHolder);

//         //GETTING TOKEN Holder data

//             if(account) {
//                 const getTokenHolderData = await DLT_TOKEN_CONTRACT.getTokenHolderData(
//                     account
//                 );

//                 const currentHolder ={
//                 tokenId: getTokenHolderData[0].toNumber(),
//                 from: getTokenHolderData[1],
//                 toastId: getTokenHolderData[2],
//                 totalToken: ethers.utils.formatEther(
//                     getTokenHolderData[3].toString()
//                 ),

//                 tokenHOlder: getTokenHolderData[4],
//                 };
//                 setCurrentHolder(currentHolder);
//             }

//             //TOKEN SALE CONTRACT
//             const AFRICA_CONTRACT = await internalAfricaContract();
//             const tokenPrice = await AFRICA_CONTRACT.tokenPrice();
//             const tokenSold = await AFRICA_CONTRACT.tokenSold();
//             const tokenSaleBalance = await AFRICA_CONTRACT.balanceOf(
//                 "0x117B8d82b60e3e646F80EFA7816e46471e54b799"
                
//             );

//             const tokenSale = {
//                 tokenPrice: ethers.utils.formatEther(tokenPrice.toString()),
//                 tokenSold: tokenSold.toNumber(),
//                 tokenSaleBalance: ethers.utils.formatEther(tokenSaleBalance.toString()),
//             }
//             setTokenSale(tokenSale);
//             console.log(tokenSale);
//             console.log(nativeToken);
            
//         } catch(error) {
//             console.log(error);
//         }
//     };
    
//     useEffect(() => {
//         fetchInitialData();
//     }, []);

//     const buyToken = async (nToken) => {
//         try{
//             setLoader(true);
//             const PROVIDER = await web3Provider();
//             const signer = PROVIDER.getSigner();

//             const contract = await internalAfricaContract();
//             console.log(contract);

//             const price = 0.0001 * nToken;
//             const amount = ethers.utils.parseUnits ( price, toString(), "ether" );

//             const buying = await contract.connect(signer).buyTokens(nToken, {
//                 value: amount.toString(),
//                 gasLimit: ethers.utils.hexlify(1000000),
//             });

//             await buying.await();
//             window.location.reload();
//         } catch (error) {
//             const errMsg = parseErrMsg(error);
//             console.log(error);
//             setLoader(false);
//             notifyError(errMsg);
//         }
//     };

//     //NATIVE TOKEN TRANSFER
//     const transferNativeToken = async  () => {
//         try {
//             setLoader(true);
//             const PROVIDER = await web3Provider();
//             const signer = PROVIDER.getSigner();


//             const TOKEN_SALE_ADDRESS = "0x117B8d82b60e3e646F80EFA7816e46471e54b799"
//             const TOKEN_AMOUNT = 2000;
//             const tokens = TOKEN_AMOUNT.toString();
//             const transferAmount = ethers.utils.parseEther(tokens);


//             const contract = await internalDltContract();
//             const transaction = await contract
//             .connect(signer)
//             .transfer(TOKEN_SALE_ADDRESS, transferAmount);

//             await transaction.reload();

//             window.location.reload();
//         } catch(error){
//         const errorMsg = parseErrMsg(error);
//         setLoader(false);
//         notifyError(errorMsg);
//         }

//     };

//     //LIQUIDITY HISTORY
//     const GET_ALL_LIQUIDITY = async () => {
//         try {
//             //GET USER ACCOUNT
//             const account = await checkIfWalletConnected();

//             const contract = internalAddLiquidity();
//             const liquidityHistory = await contract.getAllLiquidity(account);
            

//             const Allliquidity = liquidityHistory.map((liquidity) => {
//                 const liquidityArray = {
//                     id: liquidity.id.toNumber(),
//                     network: liquidity.network,
//                     owner: liquidity.owner,
//                     poolAddress: liquidity.poolAddress,
//                     tokenA: liquidity.tokenA,
//                     tokenB: liquidity.tokenB,
//                     tokenA_Address: liquidity.tokenA_Address,
//                     tokenB_Address: liquidity.tokenB_Address,
//                     timeCreated:liquidity.timeCreated.toNumber(),
//                     transactionHash: liquidity.transactionHash
//             };
//             return liquidityArray;
//             });
//             return Allliquidity;
//         }catch(error) {
//             console.log(error);
//         }
//     }

//     return(
//         <CONTEXT.provider
//         value={{
//             connect,
//             GET_POOL_ADDRESS,
//             LOAD_TOKEN,
//             notifyError,
//             notifySucccess,
//             CREATE_LIQUIDITY,
//             GET_ALL_LIQUIDITY,
//             transferNativeToken,
//             buyToken,
//             tokenSale,
//             nativeToken,
//             address,
//             loader,
//             DAPP_Name,

//         }}
//         >
//             {children}
//             </CONTEXT.provider>
//     );

// };
