const Web3 = require("web3");
const Provider = Web3.providers.HttpProvider;
//const Provider = Web3.providers.WebsocketProvider;
const Tx = require("ethereumjs-tx").Transaction;
const Common = require("ethereumjs-common").default;
//const Interval = require('interval-promise');
const got = require("got");
const cmd = require("node-cmd");

const config = require("./config.json");
const VenusABI = require("./networks/mainnet-abi.json");
const VenusConfig = require("./networks/mainnet.json");

const PriceOracle = VenusConfig.Contracts.VenusPriceOracle;
const PriceOracleABI = VenusABI.PriceOracle;
const VenusLens = VenusConfig.Contracts.VenusLens;
const VenusLensABI = VenusABI.VenusLens;
const Unitroller = VenusConfig.Contracts.Unitroller; // proxy
const ComptrollerABI = require("./abis2/Comptroller.json");
const VAIVault = "0x0667Eed0a0aAb930af74a3dfeDD263A73994f216"; // proxy
const VAIVaultABI = require("./abis2/VAIVault.json");
const VaiUnitroller = VenusConfig.Contracts.VaiUnitroller;
const VaiControllerABI = require("./abis2/VAIController.json");
const VBep20Delegate = require("./abis2/VBep20Delegate.json");
const Bep20ABI = require("./abis2/BEP20.json");

const web3 = new Web3(new Provider(config.node.provider));
const priceOracle = new web3.eth.Contract(PriceOracleABI, PriceOracle);
const venusLens = new web3.eth.Contract(VenusLensABI, VenusLens);
const unitroller = new web3.eth.Contract(ComptrollerABI, Unitroller);
const vaiVault = new web3.eth.Contract(VAIVaultABI, VAIVault);
const vaiUnitroller = new web3.eth.Contract(VaiControllerABI, VaiUnitroller);
const vai = new web3.eth.Contract(Bep20ABI, VenusConfig.Contracts.VAI);

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

const bsc = Common.forCustomChain(
  "mainnet",
  { name: "BSC", networkId: 56, chainId: 56 },
  "istanbul"
);

const tokens = {
  vSXP: "0x2fF3d0F6990a40261c66E1ff2017aCBc282EB6d0",
  vUSDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
  vUSDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
  vBUSD: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D",
  vBNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
  vXVS: "0x151B1e2635A717bcDc836ECd6FbB62B674FE3E1D",
  vBTC: "0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B",
  vETH: "0xf508fCD89b8bd15579dc79A6827cB4686A3592c8",
  vLTC: "0x57A5297F2cB2c0AaC9D554660acd6D385Ab50c6B",
  vXRP: "0xB248a295732e0225acd3337607cc01068e3b9c10",
  vBCH: "0x5F0388EBc2B94FA8E123F404b79cCF5f40b29176",
  vDOT: "0x1610bc33319e9398de5f57B33a5b184c806aD217",
  vLINK: "0x650b940a1033B8A1b1873f78730FcFC73ec11f1f",
  vBETH: "0x972207A639CC1B374B893cc33Fa251b55CEB7c07",
  vDAI: "0x334b3eCB4DCa3593BCCC3c7EBD1A1C1d1780FBF1",
  vFIL: "0xf91d58b5aE142DAcC749f58A49FCBac340Cb0343",
  vADA: "0x9A0AF7FDb2065Ce470D72664DE73cAE409dA28Ec",
};

const vToken = {};
for (let val of Object.values(tokens)) {
  vToken[val] = new web3.eth.Contract(VBep20Delegate, val);
}

// Utils
function toEther(val, type = "ether") {
  val = typeof val !== "string" ? val.toString() : val;
  return Number(Web3.utils.fromWei(val, type));
}

function toWei(val, type = "ether") {
  val = typeof val !== "string" ? val.toString() : val;
  return Web3.utils.toWei(val, type);
}

function round(value, decimals) {
  return Number(
    Math.floor(parseFloat(value + "e" + decimals)) + "e-" + decimals
  );
}

function isMatch(val1, val2) {
  if (val1.toLowerCase() == val2.toLowerCase()) {
    return true;
  }
  return false;
}

function isPair(pairs, symbol) {
  let result = "";
  for (let val of pairs) {
    if (symbol == `${val}USDT`) {
      result = val;
      break;
    }
  }
  return result;
}

function getTokenName(address) {
  let result = "-";
  for (let key in tokens) {
    if (isMatch(tokens[key], address)) {
      result = key.substr(1);
      break;
    }
  }
  return result;
}

function getToken(name) {
  return tokens[`v${name}`];
}

function getTokens() {
  return Object.values(tokens);
}

function getAPY(val) {
  return (Math.pow(val + 1, 365) - 1) * 100;
}

// Transaction
async function getNonce() {
  let address = process.env.METAMASK_ETH1; //config.wallet.publicKey;
  let nonce = await web3.eth.getTransactionCount(address, "pending");
  return nonce;
}

async function sendTransaction(obj) {
  let privateKey = Buffer.from(config.wallet.privateKey, "hex");
  let tx = new Tx(obj, { common: bsc });
  tx.sign(privateKey);
  let signTx = `0x${tx.serialize().toString("hex")}`;
  let sendTx = await web3.eth.sendSignedTransaction(signTx);
  return sendTx.transactionHash;
}

async function createTransaction(to, data, gas) {
  let txid = "";
  try {
    txid = await sendTransaction({
      nonce: await getNonce(),
      gasPrice: parseInt(toWei(config.bot.tx.gasPrice, "gwei")),
      gasLimit: gas,
      data: data,
      to: to,
      value: 0,
    });
  } catch (err) {
    // empty
  }
  return txid;
}

async function estimateGas(owner, func) {
  let limit = 1000000;
  let gas = await func.estimateGas({
    from: owner,
    gas: limit,
    value: 0,
  });

  if (gas >= limit) {
    throw "Gas Limit";
  }

  gas = parseInt(gas * 1.2); // fuck it!
  return gas;
}

async function createTx(owner, to, func) {
  let txid = "";
  try {
    let gas = await estimateGas(owner, func);
    txid = await createTransaction(to, func.encodeABI(), gas);
  } catch (err) {
    // empty
  }
  return txid;
}

// Binance
async function getExchangePrices() {
  let result = {};
  let pairs = Object.keys(tokens).map((val) => val.substr(1));
  for (let val of pairs) {
    result[val] = 0;
  }

  try {
    let url = "https://api.binance.com/api/v3/ticker/price";
    let json = await got(url, { timeout: 5000 }).json();
    for (let val of json) {
      let symbol = isPair(pairs, val.symbol);
      if (symbol != "") {
        result[symbol] = round(val.price, 4);
      }
    }

    // fix price
    result.BETH = result.ETH;
    result.BUSD = 0;
    result.USDT = 0;
    result.USDC = 0;
    result.DAI = 0;
  } catch (err) {
    // empty
  }
  return result;
}

// Venus Protocol
async function getOraclePrice(token) {
  let price = await priceOracle.methods.getUnderlyingPrice(token).call();
  return toEther(price);
}

async function getOraclePrices(tokens = []) {
  let result = {};
  let prices = await venusLens.methods.vTokenUnderlyingPriceAll(tokens).call();
  for (let val of prices) {
    result[getTokenName(val.vToken)] = toEther(val.underlyingPrice);
  }
  return result;
}

async function getVTokenMetadataAll(tokens = []) {
  return await venusLens.methods.vTokenMetadataAll(tokens).call();
}

async function getVTokenBalances(tokens = [], owner) {
  return await venusLens.methods.vTokenBalancesAll(tokens, owner).call();
}

async function getVTokenMetadatas(tokens) {
  let result = {};
  let metas = await getVTokenMetadataAll(tokens);
  for (let val of metas) {
    let token = getTokenName(val.vToken);
    result[token] = {
      collateralFactorMantissa: val.collateralFactorMantissa,
    };
  }
  return result;
}

async function getVTokens(tokens, owner, prices) {
  let result = [];
  let metas = await getVTokenMetadatas(tokens);
  let balances = await getVTokenBalances(tokens, owner);
  for (let val of balances) {
    if (val.balanceOfUnderlying != "0" || val.borrowBalanceCurrent != "0") {
      let token = getTokenName(val.vToken);
      let obj = {
        token: token,
        supply: toEther(val.balanceOfUnderlying),
        borrow: toEther(val.borrowBalanceCurrent),
        supplyPrice: toEther(val.balanceOfUnderlying) * prices[token],
        borrowPrice: toEther(val.borrowBalanceCurrent) * prices[token],
      };

      let borrowLimit =
        obj.supplyPrice * (metas[token].collateralFactorMantissa / 1e18);
      obj.borrowLimit = borrowLimit > 0 ? borrowLimit : 0;

      result.push(obj);
    }
  }
  return result;
}

async function getVAIBorrow(owner) {
  let borrow = await unitroller.methods.mintedVAIs(owner).call();
  return toEther(borrow);
}

async function getVAIStake(owner) {
  let userInfo = await vaiVault.methods.userInfo(owner).call();
  return toEther(userInfo.amount);
}

async function getXVSVault(owner, price) {
  let pendingXVS = await vaiVault.methods.pendingXVS(owner).call();
  return {
    vault: toEther(pendingXVS),
    price: toEther(pendingXVS) * price,
  };
}

async function getXVSAccrued(owner, price) {
  let meta = await venusLens.methods
    .getXVSBalanceMetadataExt(
      VenusConfig.Contracts.XVS,
      VenusConfig.Contracts.Unitroller,
      owner
    )
    .call();
  return {
    accrued: toEther(meta.allocated),
    price: toEther(meta.allocated) * price,
  };
}

async function getVTokenAPY(token) {
  let supplyRatePerBlock = await vToken[token].methods
    .supplyRatePerBlock()
    .call();
  supplyRatePerBlock = supplyRatePerBlock / 1e18;
  let borrowRatePerBlock = await vToken[token].methods
    .borrowRatePerBlock()
    .call();
  borrowRatePerBlock = borrowRatePerBlock / 1e18;
  let blockPerDay = 20 * 60 * 24;
  return {
    supply: getAPY(supplyRatePerBlock * blockPerDay),
    borrow: getAPY(borrowRatePerBlock * blockPerDay),
  };
}

async function getVenusAPY(token, prices) {
  let venusSpeed = await unitroller.methods.venusSpeeds(token).call();
  venusSpeed = venusSpeed / 1e18;
  let venusPrice = prices.XVS;
  let tokenPrice = prices[getTokenName(token)];
  let exchangeRate = await vToken[token].methods.exchangeRateCurrent().call();
  exchangeRate = exchangeRate / 1e18;
  let totalBorrows = await vToken[token].methods.totalBorrowsCurrent().call();
  totalBorrows = totalBorrows / 1e18;
  let totalSupply = await vToken[token].methods.totalSupply().call();
  totalSupply = (totalSupply * exchangeRate) / 1e18;
  let venusPerDay = venusSpeed * (20 * 60 * 24);
  let tokenPerDay = (venusPerDay * venusPrice) / tokenPrice;
  return {
    supply: getAPY(tokenPerDay / totalSupply),
    borrow: getAPY(tokenPerDay / totalBorrows),
  };
}

async function getVaultAPY(amount = 0, price) {
  let totalVAI = await vai.methods.balanceOf(VAIVault).call();
  totalVAI = toEther(totalVAI);
  let venusVAIVaultRate = await unitroller.methods.venusVAIVaultRate().call();
  venusVAIVaultRate = venusVAIVaultRate / 1e18;
  let venusPerDay = (amount / totalVAI) * (venusVAIVaultRate * (20 * 60 * 24));
  let vaiPerYear = venusPerDay * price * 365;
  let vaultAPY = (vaiPerYear * 100) / amount;
  return vaultAPY;
}

// mint, repay, stake, unstake
async function mintVAI(owner, amount) {
  let func = vaiUnitroller.methods.mintVAI(amount);
  return await createTx(owner, VaiUnitroller, func);
}

async function repayVAI(owner, amount) {
  let func = vaiUnitroller.methods.repayVAI(amount);
  return await createTx(owner, VaiUnitroller, func);
}

async function depositVAIVault(owner, amount) {
  let func = vaiVault.methods.deposit(amount);
  return await createTx(owner, VAIVault, func);
}

async function withdrawVAIVault(owner, amount) {
  let func = vaiVault.methods.withdraw(amount);
  return await createTx(owner, VAIVault, func);
}

const mdxTokens = {
  MDEX: "0x9c65ab58d8d978db963e63f2bfb7121627e3a739",
  BNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  BTC: "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c",
  USDT: "0x55d398326f99059ff775485246999027b3197955",
  BUSD: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
  BCH: "0x8ff795a6f4d97e7887c79bea79aba5cc76444adf",
  //SXP: "0x47bead2563dcbf3bf2c9407fea4dc236faba485a",
};

var mdxTokensInverse = new Map();
for (let val of Object.keys(mdxTokens)) {
  mdxTokensInverse.set(mdxTokens[val], val);
}
//console.log('reverse:', mdxTokensInverse)

const tokenUSDT = {
  MDEX: "0xe1cBe92b5375ee6AfE1B22b555D257B4357F6C68",
  BNB: "0x09CB618bf5eF305FadfD2C8fc0C26EeCf8c6D5fd",
  BTC: "0xda28Eb7ABa389C1Ea226A420bCE04Cb565Aafb85",
  // usdt: "0x55d398326f99059ff775485246999027b3197955",
  BUSD: "0x62c1dEC1fF328DCdC157Ae0068Bb21aF3967aCd9",
  //BCH: "", //set price to 0
  // sxp: "0x47bead2563dcbf3bf2c9407fea4dc236faba485a",
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
    // console.log(b)
  }
  wallet_token_balance["BNB"] += await getEthBalnce(myAddress);

  async function getEthBalnce(account) {
    return (await web3.eth.getBalance(account)) / 1e18;
  }
}

const mdexPairBSCAbi = require("./abis2/mdexpairbsc.json");
const hecoPoolBSCAbi = require("./abis2/HecoPoolBSC.json");
const lp_token_balance = {};
async function tokens_in_pool() {
  // pid , lp_address
  //return shares of each tokens & pending mdx rewards
  // 0xc48FE252Aa631017dF253578B1405ea399728A50
  // 0x35 wbnb busd 0x340192D37d95fB609874B1db6145ED26d1e47744
  let lps = [
    //name , address, decimals, lowPrice, highPrice
    //[0x35, ['0x340192D37d95fB609874B1db6145ED26d1e47744', "wbnb", 18, "busd", 18]]
    [
      0x35,
      "0x340192D37d95fB609874B1db6145ED26d1e47744",
      "wbnb",
      18,
      "busd",
      18,
    ],
    [
      0x28,
      "0x223740a259E461aBeE12D84A9FFF5Da69Ff071dD",
      "mdex",
      18,
      "busd",
      18,
    ],
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
      "0xc48FE252Aa631017dF253578B1405ea399728A50" //"0xFB03e11D93632D97a8981158A632Dd5986F5E909"
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
    //console.log('r:', rewardMdx)
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
    setAmount("MDEX", rewardMdx[0] / Math.pow(10, 18));
  }
}

const boardRoomHMDXAbi = require("./abis2/BoardRoomHMDX.json");
const board_token_balance = {};
async function tokens_in_board() {
  let lps = [
    //name , address, decimals, lowPrice, highPrice
    [0x1, "0xAf9Aa53146C5752BF6068A84B970E9fBB22a87bc", "mdex", 18, "wbnb", 18],
  ];

  for (let val of Object.keys(mdxTokens)) {
    board_token_balance[val] = 0;
  }

  let setAmount = function (token, amount) {
    let arr = Object.keys(mdxTokens);
    //console.log(arr, token)
    if (arr.indexOf(token) != -1) {
      //console.log('token:', token, amount)
      board_token_balance[token] += amount;
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
      boardRoomHMDXAbi,
      "0x55c11417C7D9789161A3F8478b8B9057830a6fc9"
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
    //console.log('r:', rewardMdx)
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
    setAmount("MDEX", rewardMdx / Math.pow(10, 18));
  }
}

const token_price = {};
async function getTokensPrice() {
  //input tokenUSDT
  //output token_price
  for (let key of Object.keys(tokenUSDT)) {
    //board_token_balance[val] = 0;
    //console.log(key, tokenUSDT[key])
    const currentTokenContract = new web3.eth.Contract(
      mdexPairBSCAbi,
      tokenUSDT[key]
    );
    const token0 = (
      await currentTokenContract.methods.token0().call()
    ).toLowerCase();
    const token1 = (
      await currentTokenContract.methods.token1().call()
    ).toLowerCase();
    const reserves = await currentTokenContract.methods.getReserves().call();
    //console.log(token0, token1)
    if (token0 == "0x55d398326f99059ff775485246999027b3197955") {
      token_price[key] =
        parseInt(reserves._reserve0) / parseInt(reserves._reserve1);
    } else if (token1 == "0x55d398326f99059ff775485246999027b3197955") {
      token_price[key] =
        parseInt(reserves._reserve1) / parseInt(reserves._reserve0);
    } else {
      console.log("tokenUsdt map error, no USDT include");
      process.exit();
    }
  }
  token_price["BCH"] = 0;
  token_price["USDT"] = 1;
}

let venus_token_balance = {};
async function getVenusTokens() {
  for (let val of Object.keys(mdxTokens)) {
    let v = { supply: 0, borrow: 0 };
    venus_token_balance[val] = v;
  }
  let prices = await getOraclePrices(getTokens());
  let vTokens = await getVTokens(getTokens(), myAddress, prices);
  let VAIBorrow = await getVAIBorrow(myAddress);
  //let VAIStake = await getVAIStake(myAddress);
  //let totalSupply = vTokens.reduce((a, b) => a + b.supplyPrice, 0);
  let totalBorrow = vTokens.reduce((a, b) => a + b.borrowPrice, 0);
  totalBorrow += VAIBorrow;
  let borrowLimit = vTokens.reduce((a, b) => a + b.borrowLimit, 0);
  let borrowPercent = (totalBorrow / borrowLimit) * 100;
  console.log(new Date(), "borrowPercent:", borrowPercent);
  if (borrowPercent > config.venus_warning_rate.high) {
    cmd.runSync("say " + "bnb借贷抵押率超过" + borrowPercent.toFixed(1));
  } else if (borrowPercent < config.venus_warning_rate.low) {
    cmd.runSync("say " + "bnb借贷抵押率低于" + borrowPercent.toFixed(1));
  }
  //let delta = {}
  //console.log("vTokens:", vTokens);
  for (let i in vTokens) {
    //console.log(vTokens[i])
    venus_token_balance[vTokens[i].token] = {
      supply: vTokens[i].supply,
      borrow: vTokens[i].borrow,
    };
  }
}
//await calculator();
const myAddress = config.account.L5;

async function main() {
  while (1) {
    try {
      let delta = {};
      //await calculator();
      //venus_token_balance = {};

      //get venus balance
      await getVenusTokens();
      //console.log('venus_token_balance:', venus_token_balance);

      //get price
      await getTokensPrice();
      //console.log("token_price:", token_price);
      await tokens_in_pool();
      //console.log('lp: ', lp_token_balance);

      await tokens_in_board();
      //console.log('board: ', board_token_balance);

      //get account balance
      await tokens_in_wallet();
      //console.log('wallet: ', wallet_token_balance);
      let profit = 0;
      for (let val of Object.keys(mdxTokens)) {
        //onsole.log(val)
        //console.log(venus_token_balance[val])
        delta[val] =
          wallet_token_balance[val] +
          board_token_balance[val] +
          lp_token_balance[val] +
          venus_token_balance[val].supply -
          venus_token_balance[val].borrow -
          config.bsc_initial_fund[val];
        //console.log(val, config.bsc_initial_fund[val]);
        //console.log(delta[val], token_price[val])
        profit += delta[val] * token_price[val];
      }
      // console.log('delta:', delta);
      console.log(
        new Date(),
        `profit:${profit.toFixed(0)}usdt  ${delta.BNB.toFixed(
          3
        )}BNB, ${delta.BTC.toFixed(6)}BTC ${delta.MDEX.toFixed(
          1
        )}MDEX ${delta.USDT.toFixed(0)}USDT ${delta.BUSD.toFixed(0)}BUSD`
      );

      //caculator profit
    } catch (err) {
      console.log(err);
    }
    await sleep(60000);
  }
}

main();
