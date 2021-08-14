const Web3 = require("web3");
const Provider = Web3.providers.HttpProvider;
const cmd = require("node-cmd");
const config = require("./config.json");
const web3 = new Web3(new Provider(config.node.hecoProvider));
const Bep20ABI = require("./abis2/BEP20.json");

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

const mdxTokens = {
  USDT: "0xa71EdC38d189767582C38A3145b5873052c3e47a",
  HBTC: "0x66a79D23E58475D2738179Ca52cd0b41d73f0BEa",
  WHT: "0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f",
  HPT: "0xE499Ef4616993730CEd0f31FA2703B92B50bB536",
  MDX: "0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c",
  USDC: "0x9362bbef4b8313a8aa9f0c9808b80577aa26b73b",
  HFIL: "0xae3a768f9aB104c69A7CD6041fE16fFa235d1810",
  HLTC: "0xecb56cf772B5c9A6907FB7d32387Da2fCbfB63b4",
};

var mdxTokensInverse = new Map();
for (let val of Object.keys(mdxTokens)) {
  mdxTokensInverse.set(mdxTokens[val].toLowerCase(), val);
}
//console.log('reverse:', mdxTokensInverse)

//Get Price From Token/USDT , when no Token/BUSD
const tokenUSDT = {
  HPT: ["0xde5b574925ee475c41b99a7591ec43e92dcd2fc1", 18],
  WHT: ["0x499B6E03749B4bAF95F9E70EeD5355b138EA6C31", 18],
  MDX: ["0x615E6285c5944540fd8bd921c9c8c56739Fd1E13", 18],
  HBTC: ["0xfbe7b74623e4be82279027a286fa3a5b5280f77c", 18],
  USDC: ["0xf37de9f4e1a0a58f839dba868e76b5779109c2a4", 6],
  HFIL: ["0x600072af0470d9ed1d83885d03d17368943ff22a", 18],
  HLTC: ["0x060b4bfce16d15a943ec83c56c87940613e162eb", 18],
};

function getmTokens() {
  ///
  return Object.values(mdxTokens);
}

const mToken = {};
for (let val of Object.values(mdxTokens)) {
  mToken[val] = new web3.eth.Contract(Bep20ABI, val);
}

async function getEthBalnce(account) {
  return (await web3.eth.getBalance(account)) / 1e18;
}

let wallet_token_balance = {};
async function tokens_in_wallet() {
  for (let val of Object.keys(mdxTokens)) {
    //console.log(mdxTokens[val])
    let b =
      (await mToken[mdxTokens[val]].methods.balanceOf(myAddress).call()) /
      Math.pow(10, await mToken[mdxTokens[val]].methods.decimals().call());
    wallet_token_balance[val] = b;
    //console.log('balance', val, b)
  }
  wallet_token_balance["WHT"] += await getEthBalnce(myAddress);
}

const mdexPairBSCAbi = require("./abis2/mdexpairbsc.json");
const hecoPoolAbi = require("./abis2/HecoPool.json");
const lp_token_balance = {};
async function tokens_in_pool() {
  // pid , lp_address
  //return shares of each tokens & pending mdx rewards
  let lps = [
    //name , address, decimals, lowPrice, highPrice

    [0xb, "0x060b4bfce16d15a943ec83c56c87940613e162eb", "HLTC", 18, "USDT", 18],
    [0xe, "0x600072af0470d9ed1d83885d03d17368943ff22a", "HFIL", 18, "USDT", 18],
    [0x10, "0x615e6285c5944540fd8bd921c9c8c56739fd1e13", "MDX", 18, "USDT", 18],
    [0x11, "0x499B6E03749B4bAF95F9E70EeD5355b138EA6C31", "WHT", 18, "USDT", 18],
    [0x12, "0xde5b574925ee475c41b99a7591ec43e92dcd2fc1", "HPT", 18, "USDT", 18],
  ];

  for (let val of Object.keys(mdxTokens)) {
    lp_token_balance[val] = 0;
  }

  let setAmount = function (token, amount) {
    let arr = Object.keys(mdxTokens);
    //console.log(arr, token)
    if (arr.indexOf(token) != -1) {
      //console.log('token:', token, amount)
      lp_token_balance[token] += amount;
    } else {
      console.log("no initial token", token, amount);
      process.exit();
    }
  };

  for (i in lps) {
    //console.log('i: ',i,  lps[i])
    let val = lps[i];
    const pid = val[0];
    const decimals_0 = val[3];
    const decimals_1 = val[5];
    const currentTokenContract = new web3.eth.Contract(mdexPairBSCAbi, val[1]);

    const hecoPoolContract = new web3.eth.Contract(
      hecoPoolAbi,
      "0xFB03e11D93632D97a8981158A632Dd5986F5E909"
    );
    const totalSupply = await currentTokenContract.methods.totalSupply().call();
    const reserves = await currentTokenContract.methods.getReserves().call();
    const lpAmount = await hecoPoolContract.methods
      .userInfo(pid, myAddress)
      .call();
    const token0 = await currentTokenContract.methods.token0().call();
    const token1 = await currentTokenContract.methods.token1().call();
    const rewardMdx = await hecoPoolContract.methods
      .pending(pid, myAddress)
      .call();

    // console.log(mdxTokensInverse, token0.toLowerCase())
    // console.log('key', mdxTokensInverse[token0.toLowerCase()])
    // console.log('lpAmount:', lpAmount, parseInt(reserves._reserve0), parseInt(lpAmount.amount), parseInt(totalSupply), decimals_0, decimals_1)
    const amount0 =
      ((parseInt(reserves._reserve0) / Math.pow(10, decimals_0)) *
        parseInt(lpAmount.amount)) /
      totalSupply;
    const amount1 =
      ((parseInt(reserves._reserve1) / Math.pow(10, decimals_1)) *
        parseInt(lpAmount.amount)) /
      totalSupply;
    setAmount(mdxTokensInverse.get(token0.toLowerCase()), amount0);
    setAmount(mdxTokensInverse.get(token1.toLowerCase()), amount1);
    setAmount("MDX", rewardMdx[0] / Math.pow(10, 18));

    let u_value = 0;
    let mainToken;
    if (mdxTokensInverse.get(token0.toLowerCase()) == "USDT") {
      u_value = amount0;
      mainToken = mdxTokensInverse.get(token1.toLowerCase());
    } else if (mdxTokensInverse.get(token1.toLowerCase()) == "USDT") {
      u_value = amount1;
      mainToken = mdxTokensInverse.get(token0.toLowerCase());
    } else if (mdxTokensInverse.get(token0.toLowerCase()) == "WHT") {
      u_value = amount0 * token_price["WHT"];
      mainToken = mdxTokensInverse.get(token1.toLowerCase());
    } else if (mdxTokensInverse.get(token1.toLowerCase()) == "WHT") {
      u_value = amount1 * token_price["WHT"];
      mainToken = mdxTokensInverse.get(token0.toLowerCase());
    }

    const reward = rewardMdx[0] / Math.pow(10, 18);
    if (u_value != 0)
      console.log(
        mainToken,
        "lp MDEX reaward:",
        reward.toFixed(2),
        (u_value * 2).toFixed(0),
        (reward / u_value / 2).toFixed(6)
      );
    else
      console.log(
        "lp MDEX reaward:",
        reward.toFixed(2),
        (u_value * 2).toFixed(0),
        "0 Value"
      );
    //check each profit rate
  }
}

const PERC20 = require("./abis2/PERC20.json");
const tokens = {
  vUSDT: "0x12D803497D1e58dD4D4A4F455D754f1d0F937C8b",
  vHBTC: "0x2dd8FFA7923a17739F70C34759Af7650e44EA3BE",
  vWHT: "0x75DCd2536a5f414B8F90Bb7F2F3c015a26dc8c79",
  vHPT: "0x811Cd5CB4cC43F44600Cfa5eE3F37a402C82aec2",
  vMDX: "0x30ac79B557973771c931D8d765E0728261A742a0",
  vUSDC: "0x2a8Cd78bFb91ACF53f589961D213d87c956e0d7f",
  vHFIL: "0x0C8c1ab017c3C0c8A48dD9F1DB2F59022D190f0b",
  vHLTC: "0x417FDfC74503d8008AeEB53248E5C0f1960c2C1d",
};

const pledgeRate = {
  vUSDT: 0.9,
  vHBTC: 0.8,
  vWHT: 0.8,
  vHPT: 0.2,
  vMDX: 0.5,
  vUSDC: 0.9,
  vHFIL: 0.6,
  vHLTC: 0.6,
};

const vToken = {};
for (let val of Object.values(tokens)) {
  vToken[val] = new web3.eth.Contract(PERC20, val);
}

const piggy_token_balance = {};

async function tokens_in_wepiggy() {
  for (let val of Object.keys(mdxTokens)) {
    piggy_token_balance[val] = 0;
  }

  let borrowedValue = 0,
    collatelValue = 0;
  for (let key of Object.keys(tokens)) {
    //key: vBTCK, ["BTCK", "ETHK", ...]
    if (Object.keys(mdxTokens).indexOf(key.substr(1)) == -1) {
      console.log("continue", key);
      continue;
    }
    const tokenContract = vToken[tokens[key]];
    const balance = await tokenContract.methods.balanceOf(myAddress).call();
    const borrowBalanceStored = await tokenContract.methods
      .borrowBalanceStored(myAddress)
      .call();
    const exchangeRateStored = await tokenContract.methods
      .exchangeRateStored()
      .call();
    const symbol = await tokenContract.methods.symbol().call();
    // console.log(key)
    let p = key.substr(1) == "USDT" ? 18 : tokenUSDT[key.substr(1)][1];
    //console.log(key, p)
    const actualBalance =
      (balance * exchangeRateStored) / 1e18 / Math.pow(10, p);
    const actualBorrowed = borrowBalanceStored / 1e18;
    if (Object.keys(token_price).length == 0) {
      console.error("Should Put getTokensPrice before tokens_in_wepiggy");
    } else {
      if (actualBalance == 0 && actualBorrowed == 0) continue;
      else if (Object.keys(token_price).indexOf(key.substr(1)) == -1) {
        console.error(key.substr(1), "No price");
      }

      collatelValue +=
        actualBalance * token_price[key.substr(1)] * pledgeRate[key];
      borrowedValue += actualBorrowed * token_price[key.substr(1)];
      // console.log('c:',  token_price[key.substr(1)], pledgeRate[key],
      //     actualBalance, actualBorrowed,
      //     collatelValue, borrowedValue)
    }

    // console.log(
    //   symbol,
    //   balance,
    //   borrowBalanceStored,
    //   exchangeRateStored,
    //   actualBalance,
    //   actualBorrowed
    // );
    piggy_token_balance[key.substr(1)] = actualBalance - actualBorrowed;
  }

  return collatelValue == 0 ? 0 : (borrowedValue / collatelValue) * 100;
}

const token_price = {};
async function getTokensPrice() {
  //input tokenBUSD
  //output token_price
  //get price from token/usdt pool
  for (let key of Object.keys(tokenUSDT)) {
    //board_token_balance[val] = 0;
    //console.log(key, tokenUSDT[key])
    const currentTokenContract = new web3.eth.Contract(
      mdexPairBSCAbi,
      tokenUSDT[key][0]
    );
    const token0 = (
      await currentTokenContract.methods.token0().call()
    ).toLowerCase();
    const token1 = (
      await currentTokenContract.methods.token1().call()
    ).toLowerCase();
    const reserves = await currentTokenContract.methods.getReserves().call();
    //.log(token0, token1, mdxTokens['USDT'].toLowerCase())
    if (token0 == mdxTokens["USDT"].toLowerCase()) {
      token_price[key] =
        parseInt(reserves._reserve0) / parseInt(reserves._reserve1);
    } else if (token1 == mdxTokens["USDT"].toLowerCase()) {
      token_price[key] =
        parseInt(reserves._reserve1) / parseInt(reserves._reserve0);
    } else {
      console.log("tokenUSDT map error, no USDT include");
      process.exit();
    }
    token_price[key] /= Math.pow(10, 18 - tokenUSDT[key][1]);
  }

  token_price["USDT"] = 1;
  //token_price["OKT"] = 0;
}

function time_range(beginTime, endTime) {
  var strb = beginTime.split(":");
  if (strb.length != 2) {
    return false;
  }
  var stre = endTime.split(":");
  if (stre.length != 2) {
    return false;
  }
  var b = new Date();
  var e = new Date();
  var n = new Date();
  b.setHours(strb[0]);
  b.setMinutes(strb[1]);
  e.setHours(stre[0]);
  e.setMinutes(stre[1]);
  console.log("n", n, b, e);
  if (n.getTime() - b.getTime() > 0 && n.getTime() - e.getTime() < 0) {
    console.log(true);
    return true;
  } else {
    console.log(false);
    return false;
  }
}

async function token_balance(token1, address) {
  let c = new web3.eth.Contract(Bep20ABI, token1);
  return (
    (await c.methods.balanceOf(address).call()) /
    Math.pow(10, await c.methods.decimals().call())
  );
}

// async function piggy_check_borrowable() {
//   const okt_balance = await getEthBalnce(tokens["vOKT"]);
//   const okb_balance = await token_balance(mdxTokens["OKB"], tokens["vOKB"]);
//   console.log(
//     `Piggy balance okt ${okt_balance.toFixed(0)} okb ${okb_balance.toFixed(0)}`
//   );
// }

//await calculator();
const myAddress = config.account.L6;
let g_cnt = 0;

async function main() {
  while (1) {
    try {
      let delta = {};
      console.log("heco piggy start");

      //get price
      await getTokensPrice();
      console.log("token_price:", JSON.stringify(token_price));
      await tokens_in_pool();
      console.log("lp_token_balance:", JSON.stringify(lp_token_balance));
      //await tokens_in_singlePool();
      //console.log("lp_token_balance:", lp_token_balance);

      await tokens_in_wallet();
      const rate = await tokens_in_wepiggy();
      console.log("rate: ", rate);
      console.log("piggy_token_balance", JSON.stringify(piggy_token_balance));
      if (rate > config.wepiggy_warning_rate.high) {
        cmd.runSync("say " + "Heco借贷抵押率超过" + rate.toFixed(1));
      } else if (rate < config.wepiggy_warning_rate.low) {
        cmd.runSync("say " + "Heco借贷抵押率低于" + rate.toFixed(1));
      } else if (g_cnt % 5 == 0) {
        //10分钟，会提醒一次使用率
        if (time_range("7:00", "22:00")) {
          cmd.runSync("say " + "Heco使用率" + rate.toFixed(1));
        }
      }

      //console.log("wallet: ", wallet_token_balance);
      let profit = 0;
      for (let val of Object.keys(mdxTokens)) {
        //console.log(val)
        //console.log(lp_token_balance[val])
        delta[val] =
          wallet_token_balance[val] +
          piggy_token_balance[val] +
          lp_token_balance[val] -
          config.initial_fund[val];
        // console.log(val, config.initial_fund[val]);
        // console.log(delta[val], token_price[val]);
        profit += delta[val] * token_price[val];
      }
      console.log("delta:", JSON.stringify(delta));
      console.log(
        new Date(),
        `profit:${profit.toFixed(0)} USDT  ${delta.HBTC.toFixed(4)} BTCK ${(
          delta.HBTC * token_price.HBTC
        ).toFixed(0)} U_BTCB, ${(delta.MDX * token_price.MDX).toFixed(
          0
        )} U_MDX, ${(delta.WHT * token_price.WHT).toFixed(0)} U_WHT, ${(
          delta.HPT * token_price.HPT
        ).toFixed(0)} U_HPT, ${(delta.HFIL * token_price.HFIL).toFixed(
          0
        )} U_HFIL, ${(delta.HLTC * token_price.HLTC).toFixed(0)} U_HLTC, ${(
          delta.USDT * token_price.USDT
        ).toFixed(0)} U_USDT,  @${token_price.MDX.toFixed(2)}`
      );
      if (g_cnt % 10 == 0) {
        //10分钟，会提醒一次使用率
        if (time_range("7:00", "22:00")) {
          cmd.runSync("say " + "heco" + profit.toFixed(0));
        }
      }
      g_cnt++;

      //await piggy_check_borrowable();
      //caculator profit
    } catch (err) {
      console.log(err);
    }
    await sleep(60000);
  }
}

main();
//tokens_in_wepiggy()
