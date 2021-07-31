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
};

function getmTokens() {
  return Object.values(mdxTokens);
}

const mToken = {};
for (let val of Object.values(mdxTokens)) {
  mToken[val] = new web3.eth.Contract(Bep20ABI, val);
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

  async function getEthBalnce(account) {
    return (await web3.eth.getBalance(account)) / 1e18;
  }
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
    [0x0, "0x2a20F39354702FAdF7d2087EDb8C0730BCA87ca7", "BTCK", 18, "USDT", 18],
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
    console.log("lp kst reaward:", (rewardMdx / Math.pow(10, 18)).toFixed(2));
    //console.log(mdxTokensInverse, token0.toLowerCase())
    //console.log('key', mdxTokensInverse[token0.toLowerCase()])
    //console.log('lpAmount:', lpAmount, parseInt(reserves._reserve0), parseInt(lpAmount.amount), parseInt(totalSupply), decimals_0, decimals_1)
    setAmount(
      mdxTokensInverse.get(token0.toLowerCase()),
      ((parseInt(reserves._reserve0) / Math.pow(10, decimals_0)) *
        parseInt(lpAmount.amount)) /
        totalSupply
    );
    setAmount(
      mdxTokensInverse.get(token1.toLowerCase()),
      ((parseInt(reserves._reserve1) / Math.pow(10, decimals_1)) *
        parseInt(lpAmount.amount)) /
        totalSupply
    );
    setAmount("KST", rewardMdx / Math.pow(10, 18));
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
  token_price["OKT"] = 0;
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
      //console.log("wallet: ", wallet_token_balance);
      let profit = 0;
      for (let val of Object.keys(mdxTokens)) {
        //console.log(val)
        //console.log(venus_token_balance[val])
        delta[val] =
          wallet_token_balance[val] +
          lp_token_balance[val] -
          config.oec_initial_fund[val];
        //console.log(val, config.oec_initial_fund[val]);
        //console.log(delta[val], token_price[val])
        profit += delta[val] * token_price[val];
      }
      //console.log("delta:", delta);
      console.log(
        new Date(),
        `profit:${profit.toFixed(0)} USDT  ${delta.BTCK.toFixed(4)} BTCK ${(
          delta.BTCK * token_price.BTCK
        ).toFixed(0)} U_BTCB, ${(delta.KST * token_price.KST).toFixed(
          0
        )} U_KST, ${(delta.USDT * token_price.USDT).toFixed(
          0
        )} U_USDT,  @${token_price.KST.toFixed(2)}`
      );
      if (g_cnt++ % 10 == 0) {
        //10分钟，会提醒一次使用率
        if (time_range("7:00", "22:00")) {
          cmd.runSync("say " + "ok" + profit.toFixed(0));
        }
      }
      //caculator profit
    } catch (err) {
      console.log(err);
    }
    await sleep(60000);
  }
}

main();
