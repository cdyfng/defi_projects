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
  };
  //console.log("r:", r);
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

    //console.log("s5: ", s5);
    let lendingAsset =
      (s1["balanceOfUnderlying"] / 1e18) * s1["price"] +
      (s2["balanceOfUnderlying"] / 1e18) * s2["price"] +
      (s3["balanceOfUnderlying"] / 1e18) * s3["price"] +
      (s4["balanceOfUnderlying"] / 1e18) * s4["price"] +
      (s5["balanceOfUnderlying"] / 1e8) * s5["price"] +
      (s6["balanceOfUnderlying"] / 1e18) * s6["price"] +
      (s7["balanceOfUnderlying"] / 1e18) * s7["price"];
    //console.log("lendingAsset:", lendingAsset);

    let colateralAsset =
      (s1["balanceOfUnderlying"] / 1e18) * s1["price"] * 0.85 +
      (s2["balanceOfUnderlying"] / 1e18) * s2["price"] * 0 +
      (s3["balanceOfUnderlying"] / 1e18) * s3["price"] * 0.9 +
      (s4["balanceOfUnderlying"] / 1e18) * s4["price"] * 0.8 +
      (s5["balanceOfUnderlying"] / 1e8) * s5["price"] * 0.9 +
      (s6["balanceOfUnderlying"] / 1e18) * s6["price"] * 0.5 +
      (s7["balanceOfUnderlying"] / 1e18) * s7["price"] * 0.7;

    //console.log("colateralAsset:", colateralAsset);
    let borrowingAsset =
      (s1["borrowBalanceStored"] / 1e18) * s1["price"] +
      (s2["borrowBalanceStored"] / 1e18) * s2["price"] +
      (s3["borrowBalanceStored"] / 1e18) * s3["price"] +
      (s4["borrowBalanceStored"] / 1e18) * s4["price"] +
      (s5["borrowBalanceStored"] / 1e8) * s5["price"] +
      (s6["borrowBalanceStored"] / 1e18) * s6["price"] +
      (s7["borrowBalanceStored"] / 1e18) * s7["price"];
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
    }
    return { HBTC: s1, MDX: s2, USDT: s3, HT: s4, HUSD: s5, FILE: s6, DOT: s7 };
  } catch (e) {
    // statements to handle any exceptions
    console.log(e); // pass exception object to error handler
    return 0;
  }

  //process.exit();
}

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

    const lp_mdx =
      mdx_fil.token0 +
      mdx_hbtc.token0 +
      mdx_husd.token1 +
      mdx_hbtc_pool.token0 +
      mdx_hbtc_pool.rewardMdx;
    const lp_fil = mdx_fil.token1;
    const lp_hbtc = mdx_hbtc.token1 + mdx_hbtc_pool.token1;
    const lp_husd = mdx_husd.token0;
    //console.log(lp_mdx, lp_fil, lp_hbtc);

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
    //console.log(lhb_usdt, lhb_mdx, lhb_fil, lhb_hbtc);
    //console.log(`Current LHB: ${lhb_usdt.toFixed(0)}U ${lhb_mdx.toFixed(0)}Mdx ${lhb_hbtc.toFixed(5)}BTC ${lhb_fil.toFixed(3)}FIL`);

    const init_usdt = config.initial_fund.usdt;
    const init_hbtc = config.initial_fund.btc;
    const init_mdx = config.initial_fund.mdx;

    const delta_u = lp_husd + lhb_usdt + lhb_husd - init_usdt;
    const delta_mdx = lhb_mdx + lp_mdx - init_mdx;
    const delta_fil = lhb_fil + lp_fil;
    const delta_hbtc = lhb_hbtc + lp_hbtc - init_hbtc;
    //  console.log(`DELTA: ${delta_u.toFixed(0)}U\
    // ${delta_mdx.toFixed(0)}MDX ${delta_hbtc.toFixed(5)}BTC ${delta_fil.toFixed(3)}FIL`);

    const value_hbtc = delta_hbtc * s.HBTC.price;
    const value_mdx = delta_mdx * s.MDX.price;
    const value_fil = delta_fil * s.FILE.price;
    //console.log(`D U: ${delta_u.toFixed(0)}U\
    // ${value_mdx.toFixed(0)}MDX ${value_hbtc.toFixed(0)}BTC\
    // ${value_fil.toFixed(0)}FIL`);

    console.log(
      new Date(),
      `Profit: ${(delta_u + value_hbtc + value_mdx + value_fil).toFixed(
        0
      )}U Current LHB: ${lhb_usdt.toFixed(0)}U ${lhb_husd.toFixed(
        0
      )}HUSD ${lhb_mdx.toFixed(0)}Mdx ${lhb_hbtc.toFixed(
        5
      )}BTC ${lhb_fil.toFixed(3)}FIL LP : ${lp_mdx.toFixed(
        0
      )}MDX ${lp_husd.toFixed(0)}HUSD ${lp_hbtc.toFixed(5)}BTC ${lp_fil.toFixed(
        3
      )}FIL DELTA: ${delta_u.toFixed(0)}U ${delta_mdx.toFixed(
        0
      )}MDX ${delta_hbtc.toFixed(5)}BTC ${delta_fil.toFixed(
        3
      )}FIL D U: ${delta_u.toFixed(0)}U MDX_${value_mdx.toFixed(
        0
      )}U BTC_${value_hbtc.toFixed(0)}U FIL_${value_fil.toFixed(0)}U`
    );
  } catch (e) {
    console.log(e);
  }
}

const sleep = (n) => new Promise((res, rej) => setTimeout(res, n));

async function loop() {
  while (1) {
    try {
      main();
      await sleep(60000);
    } catch (e) {
      // statements to handle any exceptions
      console.log(e); // pass exception object to error handler
    }
  }
}

loop();
