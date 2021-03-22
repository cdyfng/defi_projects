const hecoAddress = "https://http-mainnet-node.huobichain.com";

const web3 = require("web3");
const cmd = require("node-cmd");
//address
const oracleAddress = "0x7b4B0d9Cd226017eA3875D49196Ea63A6ea8C278";
const usdtAddress = "0xa71edc38d189767582c38a3145b5873052c3e47a";
const mdxAddress = "0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c";
const dotAddress = "0xa2c49cee16a5e5bdefde931107dc1fae9f7773e3";
const lhbAddress = "0x8f67854497218043e1f72908ffe38d0ed7f24721";

//abi
const oracleAbi = require("./oracle.json");
// contract
const provider = new web3(hecoAddress);
const orcalContract = new provider.eth.Contract(oracleAbi, oracleAddress);

let m = new Map([
  //name , address, decimals, lowPrice, highPrice
  ["mdx", [mdxAddress, 18, 3.4, 4.3]], //7.9   6.3  5.9  5.7 5.2 4.6 4.89清算
  ["dot", [dotAddress, 18, 32, 40]],
  ["lhb", [lhbAddress, 18, 0.35, 0.5]],
  //[//3, 'three'],
]);

const getPrice = async (address, decimals) => {
  const price = await orcalContract.methods
    .consult(address, String(Math.pow(10, decimals)), usdtAddress)
    .call();
  return price / Math.pow(10, decimals);
};
const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

async function check_price(k, v) {
  try {
    let price = await getPrice(v[0], v[1]);
    if (price > v[3]) {
      cmd.runSync("say " + k + "价格超过" + price.toFixed(2));
      console.log(new Date() + "wwarning ......Price great than:", price);
    }
    if (price < v[2]) {
      cmd.runSync("say " + k + "价格低于" + price.toFixed(2));
      console.log(new Date() + "wwarning ......Price less than:", price);
    }
    console.log(new Date() + "Price :", price);
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
  }
}
//check_balance()
//mainLoop();

async function main() {
  while (1) {
    try {
      m.forEach(async function (value, key) {
        console.log(key + " = " + value);
        check_price(key, value);
      });
      await sleep(5000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}
main();
