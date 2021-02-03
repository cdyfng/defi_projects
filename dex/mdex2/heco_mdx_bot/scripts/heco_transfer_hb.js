const Web3 = require("web3");
const web3 = new Web3("https://http-mainnet.hecochain.com");

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

let walletAddress = process.env.METAMASK_ETH2;
let toAddress = process.env.METAMASK_ETH1;

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

async function main() {
  init_account();
  await send_eth();
}

main();
