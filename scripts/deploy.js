const { ethers } = require("ethers");
const hre = require("hardhat");

const tokens = (nToken) => {
    return ethers.utils.parseUnits(nToken.toString(), "ether");
};

async function main() {
    //DLT TOKEN
    const _initialSupply = tokens(500000000000);
    const Dlt = await hre.ethers.getContractFactory("Dlt");
    const dlt = await Dlt.deploy(_initialSupply);

    await dlt.deploy();
    console.log(`Dlt: ${dlt.address}`)



    //Africa Token
    const _tokenPrice = tokens(0.0001);
    const Africa = await hre.ethers.getContractFactory("Africa");
    const africa = await Africa.deploy(africa.address, _tokenPrice);

    await africa.deploy();
    console.log(`Africa: ${africa.address}`)



    //LIquality
    const Liquidity = await hre.ethers.getContractFactory("Liquidity");
    const liquidity = await Liquidity.deploy()

        await Liquidity.deploy();
        console.log(`Liquidity: ${liquidity.address}`)
}

main().catch((error) => {
    console.error(error);
    process.exitCode(1);
});