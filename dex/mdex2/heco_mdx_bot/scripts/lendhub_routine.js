const Web3 = require("web3");
const LErc20Delegator_ABI = require("../abis/LErc20Delegator").abi;
var cmd = require("node-cmd");
const web3 = new Web3("https://http-mainnet.hecochain.com");

const oracleAddress = "0x7b4B0d9Cd226017eA3875D49196Ea63A6ea8C278";
const oracleAbi = require("./oracle.json");
const orcalContract = new web3.eth.Contract(oracleAbi, oracleAddress);

const getPrice = async (address, decimals) => {
  try {
    const usdtAddress = "0xa71edc38d189767582c38a3145b5873052c3e47a";
    const price = await orcalContract.methods
      .consult(address, String(Math.pow(10, decimals)), usdtAddress)
      .call();
    return price / Math.pow(10, 18);
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
  }
};

async function getTokenStatus(
  address,
  lTokenAddress,
  underlyingTokenAddress,
  underlyingTokenDecimals,
  name
) {
  // Instantiate web3 with WebSocketProvider
  try {
    const voice_on = true;
    //var decimals = 18;

    const LErc20Delegator = lTokenAddress;
    //console.log("Address:", LErc20Delegator);
    const tokenContract = new web3.eth.Contract(
      LErc20Delegator_ABI,
      LErc20Delegator,
      (error, result) => {
        if (error) console.log(error);
        console.log("result:", result);
      }
    );

    let price;
    if (underlyingTokenAddress == "0xa71edc38d189767582c38a3145b5873052c3e47a")
      price = 1;
    else {
      price = await getPrice(underlyingTokenAddress, underlyingTokenDecimals);
      //console.log(name, "price:", price);
    }
    let borrowBalanceStored = await tokenContract.methods
      .borrowBalanceStored(address)
      .call();
    //console.log("borrowBalanceStored: ", borrowBalanceStored / 1e18, name);

    let balance = await tokenContract.methods.balanceOf(address).call();
    //console.log("balance: ", balance / 1e18, "W", name);

    let balanceOfUnderlying = await tokenContract.methods
      .balanceOfUnderlying(address)
      .call();
    //console.log("balanceOfUnderlying: ", balanceOfUnderlying / 1e18, name);
    //console.log({ borrowBalanceStored, balanceOfUnderlying, price });
    return { borrowBalanceStored, balanceOfUnderlying, price };
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
  }
}

async function lhb_routine() {
  try {
    let LHBTC = "0x1E5829E405654070cf4eaeFEA46d9a848A81462b";
    let HBTC = "0x66a79d23e58475d2738179ca52cd0b41d73f0bea";
    let s1 = await getTokenStatus(
      process.env.METAMASK_ETH1,
      LHBTC,
      HBTC,
      18,
      "HBTC"
    );

    let LMDX = "0x6c4b0a4c19E0a842580dd116A306f297dc28cAC6";
    let mdxAddress = "0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c";
    let s2 = await getTokenStatus(
      process.env.METAMASK_ETH1,
      LMDX,
      mdxAddress,
      18,
      "MDX"
    );

    let LUSDT = "0xc502F3f6f1b71CB7d856E70B574D27d942C2993C";
    let USDT = "0xa71edc38d189767582c38a3145b5873052c3e47a";
    let s3 = await getTokenStatus(
      process.env.METAMASK_ETH1,
      LUSDT,
      USDT,
      18,
      "USDT"
    );

    let LHT = "0x99a2114b282acc9dd25804782acb4d3a2b1ad215";
    let WHT = "0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f";
    let s4 = await getTokenStatus(
      process.env.METAMASK_ETH1,
      LHT,
      WHT,
      18,
      "HT"
    );
    //console.log("s4: ", s4);

    let LHUSD = "0x1c478d5d1823d51c4c4b196652912a89d9b46c30";
    let HUSD = "0x0298c2b32eae4da002a15f36fdf7615bea3da047";
    let s5 = await getTokenStatus(
      process.env.METAMASK_ETH1,
      LHUSD,
      HUSD,
      8,
      "HUSD"
    );

    let LFILE = "0x276A4829d41Bfc3885eDB60c7B008188f096b082";
    let FILE = "0xae3a768f9ab104c69a7cd6041fe16ffa235d1810";
    let s6 = await getTokenStatus(
      process.env.METAMASK_ETH1,
      LFILE,
      FILE,
      18,
      "FILE"
    );

    //console.log("s5: ", s5);
    let lendingAsset =
      (s1["balanceOfUnderlying"] / 1e18) * s1["price"] +
      (s2["balanceOfUnderlying"] / 1e18) * s2["price"] +
      (s3["balanceOfUnderlying"] / 1e18) * s3["price"] +
      (s4["balanceOfUnderlying"] / 1e18) * s4["price"] +
      (s5["balanceOfUnderlying"] / 1e8) * s5["price"] +
      (s6["balanceOfUnderlying"] / 1e18) * s6["price"] ;
    //console.log("lendingAsset:", lendingAsset);

    let colateralAsset =
      (s1["balanceOfUnderlying"] / 1e18) * s1["price"] * 0.85 +
      (s2["balanceOfUnderlying"] / 1e18) * s2["price"] * 0 +
      (s3["balanceOfUnderlying"] / 1e18) * s3["price"] * 0.9 +
      (s4["balanceOfUnderlying"] / 1e18) * s4["price"] * 0.8 +
      (s5["balanceOfUnderlying"] / 1e8) * s5["price"] * 0.9 +
       (s6["balanceOfUnderlying"] / 1e18) * s6["price"] * 0.5;

    //console.log("colateralAsset:", colateralAsset);
    let borrowingAsset =
      (s1["borrowBalanceStored"] / 1e18) * s1["price"] +
      (s2["borrowBalanceStored"] / 1e18) * s2["price"] +
      (s3["borrowBalanceStored"] / 1e18) * s3["price"] +
      (s4["borrowBalanceStored"] / 1e18) * s4["price"] +
      (s5["borrowBalanceStored"] / 1e8) * s5["price"] +
       (s6["borrowBalanceStored"] / 1e18) * s6["price"];
    //console.log("borrowingAsset:", borrowingAsset);

    let rate = (borrowingAsset / colateralAsset).toFixed(4);
    console.log(
      new Date(),
      "rate:",
      rate,
      "B:",
      borrowingAsset.toFixed(0),
      "C:",
      colateralAsset.toFixed(0),
      "L:",
      lendingAsset.toFixed(0),
      "Price:",
      s1["price"].toFixed(1),
      s2["price"].toFixed(2),
      s4["price"].toFixed(1),
      s5["price"].toFixed(1),
      s6["price"].toFixed(1),
    );
    if (rate * 100 > 87) {
      cmd.runSync("say " + "使用率大于" + (rate * 100).toFixed(2));
      console.log(new Date() + "使用率大于" + rate * 100);
    } else if (rate * 100 < 75) {
      cmd.runSync("say " + "使用率小于" + (rate * 100).toFixed(2));
      console.log(new Date() + "使用率小于" + rate * 100);
    }
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
  }

  //process.exit();
}

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

async function main() {
  while (1) {
    try {
      lhb_routine();
      await sleep(60000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}

main();
