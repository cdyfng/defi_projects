const Web3 = require("web3");
const BPOOL_ABI = require("./BPool").abi;
var cmd = require("node-cmd");

function watchTokenTransfers() {
  // Instantiate web3 with WebSocketProvider
  const web3 = new Web3(
    new Web3.providers.WebsocketProvider(
      //"wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY
      "https://127.0.0.1:8546"
    )
  );

  var decimals = 18;
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const RAZOR = "0x50DE6856358Cc35f3A9a57eAAA34BD4cB707d2cd";
  const bpoolAddress = "0xd64Bb9076F513d05Ac31D1F143edcEa6884d595f";
  // Instantiate token contract object with JSON ABI and address
  console.log("Address:", bpoolAddress);
  const tokenContract = new web3.eth.Contract(
    BPOOL_ABI,
    bpoolAddress,
    (error, result) => {
      if (error) console.log(error);
      console.log("result:", result);
    }
  );

  // Generate filter options
  const options = {
    fromBlock: "latest",
    //fromBlock: "11684400",
  };

  // Subscribe to Transfer events matching filter criteria
  tokenContract.events.LOG_SWAP(options, async (error, event) => {
    if (error) {
      console.log(error);
      return;
    }
    //console.log("event:", event);
    //buy in
    let rv = event.returnValues;
    //console.log("event.returnValues:", rv);
    //console.log("tokenIn:", rv.tokenIn)
    if (rv.tokenIn == USDC && rv.tokenOut == RAZOR) {
      console.log(
        rv.caller,
        "buy ",
        (rv.tokenAmountOut / 1e18).toFixed(1),
        "@",
        (rv.tokenAmountIn / 1e6 / (rv.tokenAmountOut / 1e18)).toFixed(3)
      );
      cmd.runSync("say 买入 " + (rv.tokenAmountOut / 1e18).toFixed(1));
    } else if (rv.tokenOut == USDC && rv.tokenIn == RAZOR) {
      //sell out
      console.log(
        rv.caller,
        "sell ",
        (rv.tokenAmountIn / 1e18).toFixed(1),
        "@",
        (rv.tokenAmountOut / 1e6 / (rv.tokenAmountIn / 1e18)).toFixed(3)
      );
      cmd.runSync("say 买入 " + (rv.tokenAmountIn / 1e18).toFixed(1));
    } else {
      console.log("event:", event);
      cmd.runSync("say 错误");
    }

    return;
  });
}

watchTokenTransfers();
