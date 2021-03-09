const Web3 = require("web3");
const INCHPOOL_ABI = require("./1InchFarmingRewards").abi;
var cmd = require("node-cmd");
const web3 = new Web3(
  new Web3.providers.WebsocketProvider(
    //"wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY
    "https://127.0.0.1:8546"
  )
);

async function get1inchReward(address) {
  // Instantiate web3 with WebSocketProvider

  const voice_on = true;
  var decimals = 18;

  const oneInchPoolAddress = "0x2eDe375d73D81dBd19ef58A75ba359Dd28d25De8";
  console.log("Address:", oneInchPoolAddress);
  const tokenContract = new web3.eth.Contract(
    INCHPOOL_ABI,
    oneInchPoolAddress,
    (error, result) => {
      if (error) console.log(error);
      console.log("result:", result);
    }
  );

  let earned = await tokenContract.methods.earned(address).call();
  console.log("Earned: ", earned / 1e18, "1Inch");
}

async function getCurvehReward(gauge, address) {
  const gaugeABI = require("./usdn3Crv").abi;
  //
  // Instantiate token contract object with JSON ABI and address
  console.log("Gauge:", gauge, "Address:", address);
  const tokenContract = new web3.eth.Contract(
    gaugeABI,
    gauge,
    (error, result) => {
      if (error) console.log(error);
      console.log("result:", result);
    }
  );
  //await tokenContract.methods.user_checkpoint(address).call();
  let earned = await tokenContract.methods.claimable_tokens(address).call();
  console.log("Earned: ", earned / 1e18, "Curve");
}

async function getSushiReward(gauge, address) {
  const sushiMasterChef = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd";
  const gaugeABI = require("../abis/sushiMasterChef").abi;
  //
  // Instantiate token contract object with JSON ABI and address
  console.log("Gauge:", 21, "Address:", sushiMasterChef); //21 means WBTC/ETH pool
  const tokenContract = new web3.eth.Contract(
    gaugeABI,
    sushiMasterChef,
    (error, result) => {
      if (error) console.log(error);
      console.log("result:", result);
    }
  );
  //await tokenContract.methods.user_checkpoint(address).call();
  let earned = await tokenContract.methods.pendingSushi(gauge, address).call();
  console.log("Earned: ", earned / 1e18, "Sushi");
}

async function main() {
  const bbtcGauge = "0xdFc7AdFa664b08767b735dE28f9E84cd30492aeE";
  const usdnGauge = "0xF98450B5602fa59CC66e1379DFfB6FDDc724CfC4";

  await getSushiReward(21, process.env.L2);
  await get1inchReward(process.env.L2);
  await getCurvehReward(bbtcGauge, process.env.L3);
  await getCurvehReward(usdnGauge, process.env.L2);
  process.exit();
}

main();
