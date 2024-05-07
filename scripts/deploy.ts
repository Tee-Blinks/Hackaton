import { ethers } from "ethers";
import hre from "hardhat";

const tokens = (nToken: number): ethers.BigNumber => {
    return ethers.utils.parseUnits(nToken.toString(), "ether");
};

async function main(): Promise<void> {
    try {
        // DLT TOKEN
        const _initialSupply = tokens(500000000000);
        const Dlt = await hre.ethers.getContractFactory("Dlt");
        const dlt = await Dlt.deploy(_initialSupply);

        await dlt.deployed();
        console.log(`Dlt: ${dlt.address}`);

       // Africa Token
const _tokenPrice = tokens(0.0001);
// Assuming _tokenContract is the address of another deployed contract
const _tokenContract = "0x94f837a256e8D5541493bA5A3Df0A7aad8e0a271"; // Replace with the actual address
const Africa = await hre.ethers.getContractFactory("Africa");
const africa = await Africa.deploy(_tokenContract, _tokenPrice);

await africa.deployed();
console.log(`Africa: ${africa.address}`);


        // Liquidity
        const Liquidity = await hre.ethers.getContractFactory("Liquidity");
        const liquidity = await Liquidity.deploy();

        await liquidity.deployed();
        console.log(`Liquidity: ${liquidity.address}`);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
