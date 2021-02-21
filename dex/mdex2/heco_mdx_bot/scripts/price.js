const hecoAddress = "https://http-mainnet-node.huobichain.com";

const web3 = require("web3");
const cmd = require("node-cmd");
//address
const oracleAddress = "0x7b4B0d9Cd226017eA3875D49196Ea63A6ea8C278";
const usdtAddress = "0xa71edc38d189767582c38a3145b5873052c3e47a";
const mdxAddress = "0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c";
//abi
const oracleAbi = require("./oracle.json");
// contract
const provider = new web3(hecoAddress);
const orcalContract = new provider.eth.Contract(oracleAbi, oracleAddress);

const getMDXPrice = async () => {
  const mdxPrice = await orcalContract.methods
    .consult(mdxAddress, String(Math.pow(10, 18)), usdtAddress)
    .call();
  return mdxPrice / 1e18;
};
const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

async function mainLoop() {
  while (1) {
    try {
      let price = await getMDXPrice();
      if (price > 9.5) {
        cmd.runSync("say 价格超过" + price.toFixed(2));
        console.log(new Date() + "wwarning ......Price great than:", price);
      }
      if (price < 7) {
        cmd.runSync("say 价格低于" + price.toFixed(2));
        console.log(new Date() + "wwarning ......Price less than:", price);
      }
      console.log(new Date() + "Price :", price);
      await sleep(5000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}
//check_balance()
mainLoop();
