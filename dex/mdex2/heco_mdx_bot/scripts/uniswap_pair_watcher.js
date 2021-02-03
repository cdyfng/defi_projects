const Web3 = require("web3");
const UNIPAIR_ABI = require("./UniswapV2Pair").abi;
var cmd = require("node-cmd");

function watchTokenTransfers() {
  // Instantiate web3 with WebSocketProvider
  const web3 = new Web3(
    new Web3.providers.WebsocketProvider(
      "wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY
    )
  );

  var decimals = 9;
  var api3_eth = "0x4Dd26482738bE6C06C31467a19dcdA9AD781e8C4";
  var base_eth = "0xdE5b7Ff5b10CC5F8c95A2e2B643e3aBf5179C987";
  var bondly_eth = "0x9dc696f1067a6B9929986283f6D316Be9C9198Fd";
  // Instantiate token contract object with JSON ABI and address
  console.log("Address:", bondly_eth);
  const tokenContract = new web3.eth.Contract(
    UNIPAIR_ABI,
    bondly_eth,
    (error, result) => {
      if (error) console.log(error);
      console.log("result:", result);
    }
  );

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

    if (
      event.returnValues.amount1In == 0 &&
      event.returnValues.amount0Out == 0
    ) {
      if (event.returnValues.amount1Out / 1e18 >= 3) {
        cmd.runSync("say big sell");
      }
      //sell
    } else if (
      event.returnValues.amount0In == 0 &&
      event.returnValues.amount1Out == 0
    ) {
      //buy
      if (event.returnValues.amount1In / 1e18 >= 3) {
        cmd.runSync("say big buy");
      }
    } else {
      console.log("EEEEEEEEEEEEEEEEError");
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
    if (
      event.returnValues.sender ==
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" &&
      event.returnValues.to == "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    ) {
      console.log("Transaction event is: " + JSON.stringify(event) + "\n");
    }
    return;
  });
}

watchTokenTransfers();
