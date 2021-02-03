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
      console.log("HT balance of Lendhub:", b);
      if (b > 100) {
        cmd.runSync("say HT " + b.toFixed(0));
        console.log(new Date() + "You can borrow:", b);
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
