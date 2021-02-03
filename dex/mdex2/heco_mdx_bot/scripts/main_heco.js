const Web3 = require("web3");
const web3 = new Web3("https://http-mainnet.hecochain.com");
// function sleep(ms) {
//     return new Promise(resolve =>setTimeout(() =>resolve(), ms));
// };
const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

async function getChainId() {
  let chainId = await web3.eth.getChainId();
  console.log(`chain id: ${chainId}`);
  return chainId;
}

//const Web3 = require("web3");
const ABI = require("./CtokenInterface").abi;
var cmd = require("node-cmd");

//let token1 = '0xa2c49cee16a5e5bdefde931107dc1fae9f7773e3' //Heco-Peg HDOT Token
let token1 = "0x25d2e80cb6b86881fd7e07dd263fb79f4abe033c"; //
let address_check = "0x6c4b0a4c19E0a842580dd116A306f297dc28cAC6"; //'0x6371531a3493466788179aeece337d38117fa1ac'
async function check_balance() {
  // The minimum ABI to get ERC20 Token balance
  let minABI = [
    // balanceOf
    {
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      type: "function",
    },
    // decimals
    {
      constant: true,
      inputs: [],
      name: "decimals",
      outputs: [{ name: "", type: "uint8" }],
      type: "function",
    },
  ];
  let tokenContract = new web3.eth.Contract(minABI, token1);
  async function getBalance(address) {
    balance = await tokenContract.methods.balanceOf(address).call();
    //console.log('Balance of Dot:', balance/1e18)
    return balance;
  }
  return await getBalance(address_check);
}

async function loop_check_mdx() {
  //await check_balance()
  while (1) {
    try {
      let b = (await check_balance()) / 1e18;
      console.log("balance of Mdx:", b);
      if (b > 100) {
        cmd.runSync("say Try Borrow" + b.toFixed(0));
        console.log(new Date() + "You should borrow:", b);
      }
      await sleep(5000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}
//check_balance()
loop_check_mdx();

function watchTokenTransfers() {
  // Instantiate web3 with WebSocketProvider
  // const web3 = new Web3(
  //   new Web3.providers.WebsocketProvider(
  //     //"wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY
  //     "wss://http-mainnet.hecochain.com"
  //   )
  // );
  const web3 = new Web3("https://http-mainnet.hecochain.com");

  // var decimals = 9;
  // var api3_eth = "0x4Dd26482738bE6C06C31467a19dcdA9AD781e8C4";
  // var base_eth = "0xdE5b7Ff5b10CC5F8c95A2e2B643e3aBf5179C987";
  // var bondly_eth = "0x9dc696f1067a6B9929986283f6D316Be9C9198Fd";
  // // Instantiate token contract object with JSON ABI and address
  // console.log("Address:", bondly_eth);
  const tokenContract = new web3.eth.Contract(
    ABI,
    "0x6371531a3493466788179aeece337d38117fa1ac",
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
  tokenContract.events.Transfer(options, async (error, event) => {
    if (error) {
      console.log(error);
      return;
    }

    console.log("E: ", event);
    // if (
    //   event.returnValues.amount1In == 0 &&
    //   event.returnValues.amount0Out == 0
    // ) {
    //   if (event.returnValues.amount1Out / 1e18 >= 3) {
    //     cmd.runSync("say big sell");
    //   }
    //   //sell
    // } else if (
    //   event.returnValues.amount0In == 0 &&
    //   event.returnValues.amount1Out == 0
    // ) {
    //   //buy
    //   if (event.returnValues.amount1In / 1e18 >= 3) {
    //     cmd.runSync("say big buy");
    //   }
    // } else {
    //   console.log("EEEEEEEEEEEEEEEEError");
    // }
    // // (index_topic_1 address sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, index_topic_2 address to)
    // console.log(
    //   new Date() +
    //     event.blockNumber +
    //     "  Found Swap from " +
    //     event.returnValues.sender +
    //     " to " +
    //     event.returnValues.to +
    //     " " +
    //     event.returnValues.amount0In / 1e18 +
    //     " " +
    //     event.returnValues.amount1In / 1e18 +
    //     " " +
    //     event.returnValues.amount0Out / 1e18 +
    //     " " +
    //     event.returnValues.amount1Out / 1e18 +
    //     " " +
    //     "\n"
    // );
    // if (
    //   event.returnValues.sender ==
    //     "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" &&
    //   event.returnValues.to == "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    // ) {
    //   console.log("Transaction event is: " + JSON.stringify(event) + "\n");
    // }
    return;
  });
}

//watchTokenTransfers();

//getChainId()
