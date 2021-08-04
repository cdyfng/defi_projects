const Web3 = require("web3");
const Provider = Web3.providers.HttpProvider;
const cmd = require("node-cmd");
const config = require("./config.json");
const web3 = new Web3(new Provider(config.node.okProvider));
const Bep20ABI = require("./abis2/BEP20.json");

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

const mdxTokens = {
  KST: "0xab0d1578216a545532882e420a8c61ea07b00b12",
  BTCK: "0x54e4622dc504176b3bb432dccaf504569699a7ff",
  USDT: "0x382bb369d343125bfb2117af9c149795c6c65c50",
  OKT: "0x8f8526dbfd6e38e3d8307702ca8469bae6c56c15",
  OKB: "0xdf54b6c6195ea4d948d03bfd818d365cf175cfc2",
};

var mdxTokensInverse = new Map();
for (let val of Object.keys(mdxTokens)) {
  mdxTokensInverse.set(mdxTokens[val], val);
}
//console.log('reverse:', mdxTokensInverse)

//Get Price From Token/USDT , when no Token/BUSD
const tokenUSDT = {
  BTCK: ["0x2a20f39354702fadf7d2087edb8c0730bca87ca7", 18],
  KST: ["0x84Ee6A98990010FE87d2C79822763fCA584418E9", 18],
  OKT: ["0xd346967e8874b9c4dcdd543a88ae47ee8c8bd21f", 18],
  OKB: ["0x89824289Ae1D431aEf91bb39d666f6d0F635E1b9", 18],
};

function getmTokens() {
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
  wallet_token_balance["OKT"] += await getEthBalnce(myAddress);
}

const mdexPairBSCAbi = require("./abis2/mdexpairbsc.json");
const hecoPoolBSCAbi = require("./abis2/KswapLiquidityPool.json");
const lp_token_balance = {};
async function tokens_in_pool() {
  // pid , lp_address
  //return shares of each tokens & pending mdx rewards
  // 0xc48FE252Aa631017dF253578B1405ea399728A50
  // 0x35 wbnb busd 0x340192D37d95fB609874B1db6145ED26d1e47744
  let lps = [
    //name , address, decimals, lowPrice, highPrice
    //[0x0, "0x2a20F39354702FAdF7d2087EDb8C0730BCA87ca7", "BTCK", 18, "USDT", 18],
    [0x3, "0xd346967e8874b9c4dcdd543a88ae47ee8c8bd21f", "WOKT", 18, "USDT", 18],
    //[0x5, "0x89824289ae1d431aef91bb39d666f6d0f635e1b9", "OKB", 18, "USDT", 18],
    [0x7, "0xa25da5a44a65ee9bd4ea61f946cbcf15512fd52e", "KSP", 18, "WOKT", 18],
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
      hecoPoolBSCAbi,
      "0xaEBa5C691aF30b7108D9C277d6BB47347387Dc13"
    );
    const totalSupply = await currentTokenContract.methods.totalSupply().call();
    const reserves = await currentTokenContract.methods.getReserves().call();
    const lpAmount = await hecoPoolContract.methods
      .userInfo(pid, myAddress)
      .call();
    const token0 = await currentTokenContract.methods.token0().call();
    const token1 = await currentTokenContract.methods.token1().call();
    const rewardMdx = await hecoPoolContract.methods
      .pendingKst(pid, myAddress)
      .call();

    //console.log(mdxTokensInverse, token0.toLowerCase())
    //console.log('key', mdxTokensInverse[token0.toLowerCase()])
    //console.log('lpAmount:', lpAmount, parseInt(reserves._reserve0), parseInt(lpAmount.amount), parseInt(totalSupply), decimals_0, decimals_1)
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
    setAmount("KST", rewardMdx / Math.pow(10, 18));

    let u_value = 0;
    if (mdxTokensInverse.get(token0.toLowerCase()) == "USDT") u_value = amount0;
    else if (mdxTokensInverse.get(token1.toLowerCase()) == "USDT")
      u_value = amount1;
    else if (mdxTokensInverse.get(token0.toLowerCase()) == "OKT")
      u_value = amount0 * token_price["OKT"];
    else if (mdxTokensInverse.get(token1.toLowerCase()) == "OKT")
      u_value = amount1 * token_price["OKT"];

    const reward = rewardMdx / Math.pow(10, 18);
    if (u_value != 0)
      console.log(
        "lp kst reaward:",
        reward.toFixed(2),
        (u_value * 2).toFixed(0),
        (reward / u_value / 2).toFixed(6)
      );
    else
      console.log(
        "lp kst reaward:",
        reward.toFixed(2),
        (u_value * 2).toFixed(0),
        "0 Value"
      );
    //check each profit rate
  }
}

const singlePoolAbi = require("./abis2/KswapDepositPool.json");
async function tokens_in_singlePool() {
  // pid , lp_address
  //return shares of each tokens & pending mdx rewards
  // 0xc48FE252Aa631017dF253578B1405ea399728A50
  // 0x35 wbnb busd 0x340192D37d95fB609874B1db6145ED26d1e47744
  let sigle_pool = [
    //pid , in, decimals, out, decimals
    [0x4, "BTCK", 18, "KST", 18],
  ];

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

  const singlePoolContract = new web3.eth.Contract(
    singlePoolAbi,
    "0x5e6d7c01824c64c4bc7f2ff42c300871ce6ff555"
  );

  for (i in sigle_pool) {
    //console.log('i: ',i,  lps[i])
    let val = sigle_pool[i];
    const pid = val[0];
    const tokenIn = val[1];
    const decimalsIn = val[2];
    const tokenOut = val[3];
    const decimalsOut = val[4];
    //const currentTokenContract = new web3.eth.Contract(mdexPairBSCAbi, val[1]);

    const userInfo = await singlePoolContract.methods
      .userInfo(pid, myAddress)
      .call();
    //console.log("userInfo:", userInfo)
    const amount = userInfo[0] / Math.pow(10, decimalsIn);

    const pendingKst =
      (await singlePoolContract.methods.pendingKst(pid, myAddress).call()) /
      Math.pow(10, decimalsOut);

    console.log("sigle kst reaward:", pendingKst.toFixed(2));
    //console.log(mdxTokensInverse, token0.toLowerCase())
    //console.log('key', mdxTokensInverse[token0.toLowerCase()])
    //console.log('lpAmount:', lpAmount, parseInt(reserves._reserve0), parseInt(lpAmount.amount), parseInt(totalSupply), decimals_0, decimals_1)
    setAmount(tokenIn, amount);
    setAmount(tokenOut, pendingKst);
    //setAmount("KST", rewardMdx/ Math.pow(10, 18));
  }
}

const PERC20 = require("./abis2/PERC20.json");
const tokens = {
  vBTCK: "0x33a32f0ad4aa704e28c93ed8ffa61d50d51622a7",
  vETHK: "0x75dcd2536a5f414b8f90bb7f2f3c015a26dc8c79",
  vOKB: "0x8e1e582879cb8bac6283368e8ede458b63f499a5",
  vUSDC: "0x849c37a029b38d3826562697ccc40c34477c6293",
  vUSDT: "0xadf040519fe24ba9df6670599b2de7fd6049772f",
  vOKT: "0x621ce6596e0b9ccf635316bfe7fdbc80c3029bec",
};

const pledgeRate = {
  vBTCK: 0.8,
  vETHK: 0.8,
  vOKB: 0.5,
  vUSDC: 0.9,
  vUSDT: 0.9,
  vOKT: 0.5,
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
      //console.log("continue", key)
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
    const actualBalance = (balance * exchangeRateStored) / 1e36;
    const actualBorrowed = borrowBalanceStored / 1e18;
    if (Object.keys(token_price).length == 0) {
      console.error("Should Put getTokensPrice before tokens_in_wepiggy");
    } else {
      collatelValue +=
        actualBalance * token_price[key.substr(1)] * pledgeRate[key];
      borrowedValue += actualBorrowed * token_price[key.substr(1)];
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
    //console.log(token0, token1)
    if (token0 == "0x382bb369d343125bfb2117af9c149795c6c65c50") {
      token_price[key] =
        parseInt(reserves._reserve0) / parseInt(reserves._reserve1);
    } else if (token1 == "0x382bb369d343125bfb2117af9c149795c6c65c50") {
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

async function piggy_check_borrowable() {
  const okt_balance = await getEthBalnce(tokens["vOKT"]);
  const okb_balance = await token_balance(mdxTokens["OKB"], tokens["vOKB"]);
  console.log(
    `Piggy balance okt ${okt_balance.toFixed(0)} okb ${okb_balance.toFixed(0)}`
  );
}

//await calculator();
const myAddress = config.account.L7;
let g_cnt = 0;

async function main() {
  while (1) {
    try {
      let delta = {};

      //get price
      await getTokensPrice();
      //console.log("token_price:", token_price);
      await tokens_in_pool();
      //console.log("lp_token_balance:", lp_token_balance);
      await tokens_in_singlePool();
      //console.log("lp_token_balance:", lp_token_balance);

      await tokens_in_wallet();
      const rate = await tokens_in_wepiggy();
      console.log("rate: ", rate);
      console.log("piggy_token_balance", JSON.stringify(piggy_token_balance));
      if (rate > config.wepiggy_warning_rate.high) {
        cmd.runSync("say " + "Pig借贷抵押率超过" + rate.toFixed(1));
      } else if (rate < config.wepiggy_warning_rate.low) {
        cmd.runSync("say " + "Pig借贷抵押率低于" + rate.toFixed(1));
      } else if (g_cnt % 5 == 0) {
        //10分钟，会提醒一次使用率
        if (time_range("7:00", "22:00")) {
          cmd.runSync("say " + "Pig使用率" + rate.toFixed(1));
        }
      }

      //console.log("wallet: ", wallet_token_balance);
      let profit = 0;
      for (let val of Object.keys(mdxTokens)) {
        //console.log(val)
        //console.log(venus_token_balance[val])
        delta[val] =
          wallet_token_balance[val] +
          piggy_token_balance[val] +
          lp_token_balance[val] -
          config.oec_initial_fund[val];
        //console.log(val, config.oec_initial_fund[val]);
        //console.log(delta[val], token_price[val]);
        profit += delta[val] * token_price[val];
      }
      console.log("delta:", JSON.stringify(delta));
      console.log(
        new Date(),
        `profit:${profit.toFixed(0)} USDT  ${delta.BTCK.toFixed(4)} BTCK ${(
          delta.BTCK * token_price.BTCK
        ).toFixed(0)} U_BTCB, ${(delta.KST * token_price.KST).toFixed(
          0
        )} U_KST, ${(delta.OKT * token_price.OKT).toFixed(0)} U_OKT, ${(
          delta.OKB * token_price.OKB
        ).toFixed(0)} U_OKB, ${(delta.USDT * token_price.USDT).toFixed(
          0
        )} U_USDT,  @${token_price.KST.toFixed(2)}`
      );
      if (g_cnt % 10 == 0) {
        //10分钟，会提醒一次使用率
        if (time_range("7:00", "22:00")) {
          cmd.runSync("say " + "ok" + profit.toFixed(0));
        }
      }
      g_cnt++;

      await piggy_check_borrowable();
      //caculator profit
    } catch (err) {
      console.log(err);
    }
    await sleep(60000);
  }
}

main();
//tokens_in_wepiggy()
