const Web3 = require("web3");
const UNIPAIR_ABI = require("../abis2/UnisaveV2Pair.json");
var cmd = require("node-cmd");
const config = require("../config.json");

const web3 = new Web3("https://bsc-dataseed1.binance.org/");
var mtbt_busd = "0xCFd2416ed9eD330DBC653887462F832Ce76e8198";
// Instantiate token contract object with JSON ABI and address
console.log("Address:", mtbt_busd);
const tokenContract = new web3.eth.Contract(
  UNIPAIR_ABI,
  mtbt_busd,
  (error, result) => {
    if (error) console.log(error);
    console.log("result:", result);
  }
);

async function check_price() {
  let b0 = await tokenContract.methods.b0().call();
  let b1 = await tokenContract.methods.b1().call();
  let price = b0 / b1;
  console.log("Price ", price, b0, b1);

  if (price < config.price_coin1.low) {
    cmd.runSync("say " + "单价低于" + price.toFixed(2));
  } else if (price > config.price_coin1.high) {
    cmd.runSync("say " + "单价高于" + price.toFixed(2));
  }
}

function watchTokenTransfers() {
  // Instantiate web3 with WebSocketProvider
  // Generate filter options
  const options = {
    fromBlock: "latest",
  };

  // Subscribe to Transfer events matching filter criteria
  tokenContract.events.Swap(options, async (error, event) => {
    if (error) {
      console.log(error);
      return;
    }

    // (index_topic_1 address sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, index_topic_2 address to)
    console.log(
      new Date() +
        event.blockNumber +
        "  Found Swap from " +
        event.returnValues.sender +
        " to " +
        event.returnValues.to +
        " " +
        event.returnValues.amount0In / 1e18 +
        " " +
        event.returnValues.amount1In / 1e18 +
        " " +
        event.returnValues.amount0Out / 1e18 +
        " " +
        event.returnValues.amount1Out / 1e18 +
        " " +
        "\n"
    );
    console.log("Transaction event is: " + JSON.stringify(event) + "\n");
    await check_price();
    return;
  });
}

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

async function main() {
  while (1) {
    try {
      await check_price();
      await sleep(60000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}
//check_price();
main();
//watchTokenTransfers();
