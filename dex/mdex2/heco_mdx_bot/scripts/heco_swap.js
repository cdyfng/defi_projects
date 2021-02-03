const Web3 = require("web3");
const web3 = new Web3("https://http-mainnet.hecochain.com");

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

let walletAddress = process.env.METAMASK_ETH2;
let toAddress = process.env.METAMASK_ETH1;
const usdtHeco = "0xa71edc38d189767582c38a3145b5873052c3e47a";
const husdHeco = "0x0298c2b32eae4da002a15f36fdf7615bea3da047";
const mdxAddress = "0x25d2e80cb6b86881fd7e07dd263fb79f4abe033c";
const ethHeco = "0x64FF637fB478863B7468bc97D30a5bF3A428a1fD";
const btcHeco = "0x66a79D23E58475D2738179Ca52cd0b41d73f0BEa";

function init_account() {
  //const privateKey = process.env.;
  const account = web3.eth.accounts.privateKeyToAccount(
    "0x" + process.env.METAMASK_PRIV2
  );
  console.log("web3.eth.defaultAccount: ", web3.eth.defaultAccount);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;

  console.log("account ", account);
  console.log("web3.eth.defaultAccount: ", web3.eth.defaultAccount);
}

async function send_eth() {
  //let accounts = await web3.eth.getAccounts();
  //console.log(accounts);
  web3.eth.sendTransaction({
    from: walletAddress,
    to: process.env.METAMASK_ETH1,
    value: 50000000000000000, //0.05eth
    gasLimit: 21000,
    gasPrice: 1000000000,
  });
}

async function getBalance(token, address) {
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

  let tokenContract = new web3.eth.Contract(minABI, token);
  balance = await tokenContract.methods.balanceOf(address).call();
  return balance;
}

async function getDecimal(token) {
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

  let tokenContract = new web3.eth.Contract(minABI, token);
  let decimals = await tokenContract.methods.decimals().call();
  return decimals;
}

async function swap(sToken, dToken) {
  let swapABI = [
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "amountOutMin",
          type: "uint256",
        },
        {
          internalType: "address[]",
          name: "path",
          type: "address[]",
        },
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256",
        },
      ],
      name: "swapExactTokensForTokens",
      outputs: [
        {
          internalType: "uint256[]",
          name: "amounts",
          type: "uint256[]",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  var mdexRouter = new web3.eth.Contract(
    swapABI,
    "0xed7d5f38c79115ca12fe6c0041abb22f0a06c300"
  );

  let balance = await getBalance(sToken, walletAddress);
  console.log("usdt balance: ", balance);
  //let decimals = await getDecimal(sToken)
  //console.log('decimals:', decimals, 10**decimals)
  if (balance == 0) {
    console.log("Return When Small usdt balance: ", balance);
    return;
  }
  // if(balance <= 9000000000){
  //   NonStop = 0
  // }

  let amountIn = balance;
  let amountOutMin = 0;
  let path = [sToken, dToken];
  let to = walletAddress;
  let deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  let r = await mdexRouter.methods
    .swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)
    .send({
      from: walletAddress,
      gas: 300000,
      gasPrice: 1000000000,
    })
    .on("receipt", function (receipt) {
      //console.log(receipt);
      console.log(receipt.blockNumber, receipt.transactionHash);
    });
}

async function claim_mdx_reward() {
  const swapMiningAddress = "0x7373c42502874C88954bDd6D50b53061F018422e";
  var swapMiningabi = require("./SwapMining").abi;
  let swapMining = new web3.eth.Contract(swapMiningabi, swapMiningAddress);
  let r = await swapMining.methods
    .takerWithdraw()
    .send({
      from: walletAddress,
      gas: 200000,
      gasPrice: 1000000000,
    })
    .on("receipt", function (receipt) {
      //console.log(receipt);
      console.log(receipt.blockNumber, receipt.transactionHash);
    });
}
let NonStop = 1;
async function main() {
  init_account();
  let initBalance = await getBalance(usdtHeco, walletAddress);
  let toToken = husdHeco;
  console.log("usdt initial balance: ", initBalance);
  //while (NonStop) {
  for (let i = 0; i < 2; i++) {
    try {
      //await swap(husdHeco, usdtHeco)

      await swap(usdtHeco, toToken);
      await sleep(2000);
      await swap(toToken, usdtHeco);
      await sleep(2000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
  await claim_mdx_reward();
  await sleep(2000);
  await swap(mdxAddress, usdtHeco);
  await sleep(2000);
  let endBalance = await getBalance(usdtHeco, walletAddress);
  console.log("usdt initial balance: ", initBalance);
  console.log("usdt balance after trade: ", endBalance);
  console.log("profit: ", (endBalance - initBalance) / 1e18);
}

async function test_claim_main() {
  init_account();
  let initBalance = await getBalance(usdtHeco, walletAddress);
  console.log("usdt initial balance: ", initBalance);
  //await claim_mdx_reward();
  //await sleep(2000);
  await swap(mdxAddress, usdtHeco);
  await sleep(2000);
  let endBalance = await getBalance(usdtHeco, walletAddress);
  console.log("usdt initial balance: ", initBalance);
  console.log("usdt balance after trade: ", endBalance);
  console.log("profit: ", (endBalance - initBalance) / 1e18);
}

//test_claim_main()
main();
