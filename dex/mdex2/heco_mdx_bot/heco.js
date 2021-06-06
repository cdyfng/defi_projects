const hecoAddress = "https://http-mainnet-node.huobichain.com";

const web3 = require("web3");
//address
const oracleAddress = "0x7b4B0d9Cd226017eA3875D49196Ea63A6ea8C278";
const usdtAddress = "0xa71edc38d189767582c38a3145b5873052c3e47a";
const chefAddress = "0xFB03e11D93632D97a8981158A632Dd5986F5E909";
const mdxAddress = "0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c";
//abi
const erc20Abi = require("./abis2/erc20.json");
const mdexPairAbi = require("./abis2/mdexpair.json");
const airdropMDXAbi = require("./abis2/AirdropMDX.json");
const hecoPoolAbi = require("./abis2/HecoPool.json");
const LErc20Delegator_ABI = require("./abis/LErc20Delegator").abi;
const oracleAbi = require("./scripts/oracle.json");
const config = require("./config.json");
var cmd = require("node-cmd");

// contract
const provider = new web3(hecoAddress);
//
const BLOCKS_PER_YEAR = 10512000;
const SUSHI_PER_BLOCK = 27.3;

const orcalContract = new provider.eth.Contract(oracleAbi, oracleAddress);
const account = config.account.L6; //process.env.METAMASK_ETH1

const calculateCoins = async (
  lpAddresses,
  myAddress,
  decimals1,
  decimals2,
  pid
) => {
  const currentTokenContract = new provider.eth.Contract(
    mdexPairAbi,
    lpAddresses
  );
  const airdropMDXContract = new provider.eth.Contract(
    airdropMDXAbi,
    "0x19D054836192200c71EEc12Bc9f255b1faE8eE80"
  );
  const totalSupply = await currentTokenContract.methods.totalSupply().call();
  const reserves = await currentTokenContract.methods.getReserves().call();
  const lpAmount = await airdropMDXContract.methods
    .userInfo(pid, myAddress)
    .call();
  const rewardMdx = await airdropMDXContract.methods
    .pending(pid, myAddress)
    .call();

  console.log("MDX pending:", rewardMdx / Math.pow(10, 18));
  //console.log("mine percent:", parseInt(lpAmount.amount) / totalSupply);
  const r = {
    token0:
      ((parseInt(reserves._reserve0) / Math.pow(10, decimals1)) *
        parseInt(lpAmount.amount)) /
      totalSupply,
    token1:
      ((parseInt(reserves._reserve1) / Math.pow(10, decimals2)) *
        parseInt(lpAmount.amount)) /
      totalSupply,
    rewardMdx: parseInt(rewardMdx) / Math.pow(10, 18),
  };
  //console.log("r:", r);
  return r;
};

const calculateHTAirDorpCoins = async (
  lpAddresses,
  myAddress,
  decimals1,
  decimals2,
  pid
) => {
  const currentTokenContract = new provider.eth.Contract(
    mdexPairAbi,
    lpAddresses
  );
  const airdropMDXContract = new provider.eth.Contract(
    airdropMDXAbi,
    "0x9197d717a4F45B672aCacaB4CC0C6e09222f8695"
  );
  const totalSupply = await currentTokenContract.methods.totalSupply().call();
  const reserves = await currentTokenContract.methods.getReserves().call();
  const lpAmount = await airdropMDXContract.methods
    .userInfo(pid, myAddress)
    .call();
  const rewardWHT = await airdropMDXContract.methods
    .pending(pid, myAddress)
    .call();

  console.log("WHT pending:", rewardWHT / Math.pow(10, 18));
  //console.log("mine percent:", parseInt(lpAmount.amount) / totalSupply);
  const r = {
    token0:
      ((parseInt(reserves._reserve0) / Math.pow(10, decimals1)) *
        parseInt(lpAmount.amount)) /
      totalSupply,
    token1:
      ((parseInt(reserves._reserve1) / Math.pow(10, decimals2)) *
        parseInt(lpAmount.amount)) /
      totalSupply,
    rewardWHT: parseInt(rewardWHT) / Math.pow(10, 18),
  };
  //console.log("r:", r);
  return r;
};

const calculateHTAirDorpCoinsSingleMDX = async (myAddress) => {
  const pid = 1; //mdx -> wht
  const airdropMDXContract = new provider.eth.Contract(
    airdropMDXAbi,
    "0x9197d717a4F45B672aCacaB4CC0C6e09222f8695"
  );

  const mdxAmount = await airdropMDXContract.methods
    .userInfo(pid, myAddress)
    .call();

  const rewardWHT = await airdropMDXContract.methods
    .pending(pid, myAddress)
    .call();

  console.log("WHT pending:", rewardWHT / Math.pow(10, 18));
  //console.log("mine percent:", parseInt(lpAmount.amount) / totalSupply);
  //console.log("r:", parseInt(mdxAmount.amount), parseInt(rewardWHT));
  const r = {
    mdx: parseInt(mdxAmount.amount) / Math.pow(10, 18),
    rewardWHT: parseInt(rewardWHT) / Math.pow(10, 18),
  };
  console.log("r:", r);
  return r;
};

const calculatePoolCoins = async (
  lpAddresses,
  myAddress,
  decimals1,
  decimals2,
  pid
) => {
  //HecoPool
  const currentTokenContract = new provider.eth.Contract(
    mdexPairAbi,
    lpAddresses
  );

  const hecoPoolContract = new provider.eth.Contract(
    hecoPoolAbi,
    "0xFB03e11D93632D97a8981158A632Dd5986F5E909"
  );
  const totalSupply = await currentTokenContract.methods.totalSupply().call();
  const reserves = await currentTokenContract.methods.getReserves().call();
  const lpAmount = await hecoPoolContract.methods
    .userInfo(pid, myAddress)
    .call();
  //32 mdx/btc
  const rewardMdx = await hecoPoolContract.methods
    .pending(pid, myAddress)
    .call();

  console.log("MDX pending:", rewardMdx[0] / Math.pow(10, 18));
  //console.log("mine percent:", parseInt(lpAmount.amount) / totalSupply);
  const r = {
    token0:
      ((parseInt(reserves._reserve0) / Math.pow(10, decimals1)) *
        parseInt(lpAmount.amount)) /
      totalSupply,
    token1:
      ((parseInt(reserves._reserve1) / Math.pow(10, decimals2)) *
        parseInt(lpAmount.amount)) /
      totalSupply,
    rewardMdx: parseInt(rewardMdx[0]) / Math.pow(10, 18),
  };
  //console.log("r:", r);
  return r;
};

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

async function getEthBalnce(account) {
  return (await provider.eth.getBalance(account)) / 1e18;
}

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
    const tokenContract = new provider.eth.Contract(
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

    let account_balance = await token_balance(underlyingTokenAddress, address);
    if (underlyingTokenAddress == "0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f")
      //wht
      account_balance += await getEthBalnce(address);

    //console.log("balanceOfUnderlying: ", balanceOfUnderlying / 1e18, name);
    //console.log({ borrowBalanceStored, balanceOfUnderlying, price });
    return { borrowBalanceStored, balanceOfUnderlying, account_balance, price };
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
  }
}

async function token_balance(token1, address) {
  let c = new provider.eth.Contract(erc20Abi, token1);
  return (
    (await c.methods.balanceOf(address).call()) /
    Math.pow(10, await c.methods.decimals().call())
  );
}

async function lhb_routine() {
  try {
    let LHBTC = "0x1E5829E405654070cf4eaeFEA46d9a848A81462b";
    let HBTC = "0x66a79d23e58475d2738179ca52cd0b41d73f0bea";
    let s1 = await getTokenStatus(account, LHBTC, HBTC, 18, "HBTC");

    let LMDX = "0x6c4b0a4c19E0a842580dd116A306f297dc28cAC6";
    let mdxAddress = "0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c";
    let s2 = await getTokenStatus(account, LMDX, mdxAddress, 18, "MDX");

    let LUSDT = "0xc502F3f6f1b71CB7d856E70B574D27d942C2993C";
    let USDT = "0xa71edc38d189767582c38a3145b5873052c3e47a";
    let s3 = await getTokenStatus(account, LUSDT, USDT, 18, "USDT");

    let LHT = "0x99a2114b282acc9dd25804782acb4d3a2b1ad215";
    let WHT = "0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f";
    let s4 = await getTokenStatus(account, LHT, WHT, 18, "HT");
    //console.log("s4: ", s4);

    let LHUSD = "0x1c478d5d1823d51c4c4b196652912a89d9b46c30";
    let HUSD = "0x0298c2b32eae4da002a15f36fdf7615bea3da047";
    let s5 = await getTokenStatus(account, LHUSD, HUSD, 8, "HUSD");

    let LFILE = "0x276A4829d41Bfc3885eDB60c7B008188f096b082";
    let FILE = "0xae3a768f9ab104c69a7cd6041fe16ffa235d1810";
    let s6 = await getTokenStatus(account, LFILE, FILE, 18, "FILE");

    let LDOT = "0x6371531a3493466788179aeece337d38117fa1ac";
    let DOT = "0xa2c49cee16a5e5bdefde931107dc1fae9f7773e3";
    let s7 = await getTokenStatus(account, LDOT, DOT, 18, "DOT");

    let LBCH = "0xd92f6c1bb3296e4a2adaad56fdd8ec499e0582bb";
    let BCH = "0xef3cebd77e0c52cb6f60875d9306397b5caca375";
    let s8 = await getTokenStatus(account, LBCH, BCH, 18, "BCH");
    //bch usdt pair  0x1f0eC8e0096e145f2bf2Cb4950Ed7b52d1cbd35f

    //console.log("s8: ", s8)

    //console.log("s5: ", s5);
    let lendingAsset =
      (s1["balanceOfUnderlying"] / 1e18) * s1["price"] +
      (s2["balanceOfUnderlying"] / 1e18) * s2["price"] +
      (s3["balanceOfUnderlying"] / 1e18) * s3["price"] +
      (s4["balanceOfUnderlying"] / 1e18) * s4["price"] +
      (s5["balanceOfUnderlying"] / 1e8) * s5["price"] +
      (s6["balanceOfUnderlying"] / 1e18) * s6["price"] +
      (s7["balanceOfUnderlying"] / 1e18) * s7["price"] +
      (s8["balanceOfUnderlying"] / 1e18) * s8["price"];
    //console.log("lendingAsset:", lendingAsset);

    let colateralAsset =
      (s1["balanceOfUnderlying"] / 1e18) * s1["price"] * 0.85 +
      (s2["balanceOfUnderlying"] / 1e18) * s2["price"] * 0 +
      (s3["balanceOfUnderlying"] / 1e18) * s3["price"] * 0.9 +
      (s4["balanceOfUnderlying"] / 1e18) * s4["price"] * 0.8 +
      (s5["balanceOfUnderlying"] / 1e8) * s5["price"] * 0.9 +
      (s6["balanceOfUnderlying"] / 1e18) * s6["price"] * 0.5 +
      (s7["balanceOfUnderlying"] / 1e18) * s7["price"] * 0.7 +
      (s8["balanceOfUnderlying"] / 1e18) * s8["price"] * 0.8;

    //console.log("colateralAsset:", colateralAsset);
    let borrowingAsset =
      (s1["borrowBalanceStored"] / 1e18) * s1["price"] +
      (s2["borrowBalanceStored"] / 1e18) * s2["price"] +
      (s3["borrowBalanceStored"] / 1e18) * s3["price"] +
      (s4["borrowBalanceStored"] / 1e18) * s4["price"] +
      (s5["borrowBalanceStored"] / 1e8) * s5["price"] +
      (s6["borrowBalanceStored"] / 1e18) * s6["price"] +
      (s7["borrowBalanceStored"] / 1e18) * s7["price"] +
      (s8["borrowBalanceStored"] / 1e18) * s8["price"];
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
      s7["price"].toFixed(1)
    );

    if (rate * 100 > config.warning_rate.high) {
      cmd.runSync("say " + "使用率大于" + (rate * 100).toFixed(2));
      console.log(new Date() + "使用率大于" + rate * 100);
    } else if (rate * 100 < config.warning_rate.low) {
      cmd.runSync("say " + "使用率小于" + (rate * 100).toFixed(2));
      console.log(new Date() + "使用率小于" + rate * 100);
    } else if (g_cnt++ % 10 == 0) {
      //10分钟，会提醒一次使用率
      if (time_range("7:00", "22:00")) {
        cmd.runSync("say " + "MDX使用率" + (rate * 100).toFixed(2));
      }
    }

    return {
      HBTC: s1,
      MDX: s2,
      USDT: s3,
      HT: s4,
      HUSD: s5,
      FILE: s6,
      DOT: s7,
      BCH: s8,
    };
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
    return 0;
  }

  //process.exit();
}

let g_cnt = 0;
async function main() {
  try {
    const mdx_fil = await calculateCoins(
      "0xfc021c1Ec170C7B320cfD4DE99E83a91e7eAabBc", //"0x2Fb4bE0F2785bD6009A383f3290CC97A4e3bD46B",
      account,
      18,
      18,
      6 //MDX/FIL
    );

    const mdx_hbtc = await calculateCoins(
      "0x2fb4be0f2785bd6009a383f3290cc97a4e3bd46b", //"0x2Fb4bE0F2785bD6009A383f3290CC97A4e3bD46B",
      account,
      18,
      18,
      1 //MDX/HBTC
    );

    const mdx_husd = await calculateCoins(
      "0x59FC9FF2efe186f07E2B9F6c83F78086613e95F2",
      account,
      8,
      18,
      3 //MDX/HUSD
    );

    const mdx_hbtc_pool = await calculatePoolCoins(
      "0x2fb4be0f2785bd6009a383f3290cc97a4e3bd46b", //"0x2Fb4bE0F2785bD6009A383f3290CC97A4e3bD46B",
      account,
      18,
      18,
      32 //MDX/HBTC in Liquidity
    );

    const mdx_usdt_pool = await calculatePoolCoins(
      "0x615E6285c5944540fd8bd921c9c8c56739Fd1E13",
      account,
      18,
      18,
      16 //MDX/USDT in Liquidity
    );

    const mdx_dot_pool = await calculatePoolCoins(
      "0x640aeCF73Ca21f1bCAE74c7187CecF77F47c60Ac",
      account,
      18,
      18,
      0x29 //MDX/HDOT in Liquidity
    );
    //MDX DOT
    //0x640aeCF73Ca21f1bCAE74c7187CecF77F47c60Ac

    const usdt_hbch_pool = await calculatePoolCoins(
      "0x1f0ec8e0096e145f2bf2cb4950ed7b52d1cbd35f",
      account,
      18,
      18,
      0x0c //BCH/USDT in Liquidity
    );

    const wht_hdot_pool = await calculatePoolCoins(
      "0xcd9a26b6af1445cd48f86bd583c70e46ea6e474b",
      account,
      18,
      18,
      0x30 //Hodt/Wht in Liquidity
    );

    const mdx_usdt_airdrop_ht = await calculateHTAirDorpCoins(
      "0x615E6285c5944540fd8bd921c9c8c56739Fd1E13",
      account,
      18,
      18,
      0x0 //MDX/USDT in HT airdrop boardroom
    );

    const mdx_wht_airdrop_ht = await calculateHTAirDorpCoins(
      "0x6dd2993b50b365c707718b0807fc4e344c072ec2",
      account,
      18,
      18,
      0x2 //MDX/WHT in HT airdrop boardroom
    );

    const mdx_airdrop_ht = await calculateHTAirDorpCoinsSingleMDX(
      account
      //1 : MDX -> WHT  airdrop boardroom
    );

    const rewardMdx =
      mdx_hbtc_pool.rewardMdx +
      mdx_usdt_pool.rewardMdx +
      mdx_hbtc.rewardMdx +
      mdx_dot_pool.rewardMdx +
      usdt_hbch_pool.rewardMdx +
      wht_hdot_pool.rewardMdx;

    console.log("Total Pending MDX:", rewardMdx);
    const lp_mdx =
      mdx_fil.token0 +
      mdx_hbtc.token0 +
      mdx_husd.token1 +
      mdx_hbtc_pool.token0 +
      mdx_usdt_pool.token0 +
      mdx_dot_pool.token0 +
      mdx_usdt_airdrop_ht.token0 +
      mdx_wht_airdrop_ht.token0 +
      mdx_airdrop_ht.mdx +
      rewardMdx;
    const lp_fil = mdx_fil.token1;
    const lp_hbtc = mdx_hbtc.token1 + mdx_hbtc_pool.token1;
    const lp_husd = mdx_husd.token0;
    const lp_usdt =
      mdx_usdt_pool.token1 + usdt_hbch_pool.token0 + mdx_usdt_airdrop_ht.token1;
    const lp_dot = mdx_dot_pool.token1 + wht_hdot_pool.token1;
    const lp_bch = usdt_hbch_pool.token1;
    //console.log('lp:', lp_mdx, lp_fil, lp_hbtc, lp_bch);
    const lp_wht =
      mdx_usdt_airdrop_ht.rewardWHT +
      mdx_wht_airdrop_ht.token1 +
      mdx_wht_airdrop_ht.rewardWHT +
      mdx_airdrop_ht.rewardWHT +
      wht_hdot_pool.token0;

    const s = await lhb_routine();

    const lhb_usdt =
      s.USDT.balanceOfUnderlying / 1e18 - s.USDT.borrowBalanceStored / 1e18;
    const lhb_mdx =
      s.MDX.balanceOfUnderlying / 1e18 - s.MDX.borrowBalanceStored / 1e18;
    const lhb_fil =
      s.FILE.balanceOfUnderlying / 1e18 - s.FILE.borrowBalanceStored / 1e18;
    const lhb_hbtc =
      s.HBTC.balanceOfUnderlying / 1e18 - s.HBTC.borrowBalanceStored / 1e18;
    const lhb_husd =
      s.HUSD.balanceOfUnderlying / 1e8 - s.HUSD.borrowBalanceStored / 1e8;
    const lhb_dot =
      s.DOT.balanceOfUnderlying / 1e18 - s.DOT.borrowBalanceStored / 1e18;
    const lhb_bch =
      s.BCH.balanceOfUnderlying / 1e18 - s.BCH.borrowBalanceStored / 1e18;

    const lhb_wht =
      s.HT.balanceOfUnderlying / 1e18 - s.HT.borrowBalanceStored / 1e18;

    //console.log(lhb_usdt, lhb_mdx, lhb_fil, lhb_hbtc);
    //console.log(`Current LHB: ${lhb_usdt.toFixed(0)}U ${lhb_mdx.toFixed(0)}Mdx ${lhb_hbtc.toFixed(5)}BTC ${lhb_fil.toFixed(3)}FIL`);

    const init_usdt = config.initial_fund.usdt;
    const init_hbtc = config.initial_fund.btc;
    const init_mdx = config.initial_fund.mdx;
    const init_dot = config.initial_fund.dot;
    const init_bch = config.initial_fund.bch;
    const init_wht = config.initial_fund.wht;
    //console.log("init_bch", init_bch)
    //console.log("b: husd, ", s.HUSD.account_balance)
    const delta_u =
      lp_husd +
      lp_usdt +
      lhb_usdt +
      lhb_husd +
      s.HUSD.account_balance +
      s.USDT.account_balance -
      init_usdt;
    const delta_mdx = lhb_mdx + lp_mdx + s.MDX.account_balance - init_mdx;
    const delta_fil = lhb_fil + lp_fil + s.FILE.account_balance;
    const delta_hbtc = lhb_hbtc + lp_hbtc + s.HBTC.account_balance - init_hbtc;
    const delta_dot = lhb_dot + lp_dot + s.DOT.account_balance - init_dot;
    const delta_bch = lhb_bch + lp_bch + s.BCH.account_balance - init_bch;
    const delta_wht = lhb_wht + lp_wht + s.HT.account_balance - init_wht;
    console.log(
      "delta_wht:",
      lhb_wht,
      lp_wht,
      s.HT.account_balance,
      init_wht,
      delta_wht
    );
    //  console.log(`DELTA: ${delta_u.toFixed(0)}U\
    // ${delta_mdx.toFixed(0)}MDX ${delta_hbtc.toFixed(5)}BTC ${delta_fil.toFixed(3)}FIL`);

    const value_hbtc = delta_hbtc * s.HBTC.price;
    const value_mdx = delta_mdx * s.MDX.price;
    const value_fil = delta_fil * s.FILE.price;
    const value_dot = delta_dot * s.DOT.price;
    const value_bch = delta_bch * s.BCH.price;
    const value_wht = delta_wht * s.HT.price;
    //console.log(`D U: ${delta_u.toFixed(0)}U\
    // ${value_mdx.toFixed(0)}MDX ${value_hbtc.toFixed(0)}BTC\
    // ${value_fil.toFixed(0)}FIL`);
    console.log(
      "value: ",
      value_hbtc,
      value_fil,
      value_dot,
      value_bch,
      value_wht
    );
    console.log(
      new Date(),
      `Profit: ${(
        delta_u +
        value_hbtc +
        value_mdx +
        value_fil +
        value_dot +
        value_bch +
        value_wht
      ).toFixed(0)}U Current LHB: ${lhb_usdt.toFixed(0)}U ${lhb_husd.toFixed(
        0
      )}HUSD ${lhb_mdx.toFixed(0)}Mdx ${lhb_dot.toFixed(
        5
      )}DOT ${lhb_wht.toFixed(2)}WHT LP : ${lp_mdx.toFixed(
        0
      )}MDX ${lp_husd.toFixed(0)}HUSD ${lp_usdt.toFixed(
        0
      )}USDT ${lp_hbtc.toFixed(5)}BTC ${lp_dot.toFixed(
        3
      )}DOT DELTA: ${delta_u.toFixed(0)}U ${delta_mdx.toFixed(
        0
      )}MDX ${delta_dot.toFixed(5)}DOT ${delta_wht.toFixed(
        2
      )}WHT D U: ${delta_u.toFixed(0)}U MDX_${value_mdx.toFixed(
        0
      )}U BTC_${value_hbtc.toFixed(0)}U WHT${value_wht.toFixed(0)}U`
    );
  } catch (e) {
    console.log(e);
  }
}

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

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

async function loop() {
  while (1) {
    try {
      //console.log('btc', await token_balance("0x66a79d23e58475d2738179ca52cd0b41d73f0bea", account))

      main();
      await sleep(60000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}

loop();
