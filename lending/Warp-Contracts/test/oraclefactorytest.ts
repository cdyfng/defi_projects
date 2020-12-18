const truffleAssert = require("truffle-assertions");
const w3 = require("web3");
const utils = require("./utils.js");
const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

const toWei = w3.utils.toWei;
const fromWei = w3.utils.fromWei;

const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Pair = artifacts.require("UniswapV2Pair");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");
const WarpControl = artifacts.require("WarpControl");
const WarpVaultLP = artifacts.require("WarpVaultLP");
const WarpVaultLPFactory = artifacts.require("WarpVaultLPFactory");
const WarpVaultSC = artifacts.require("WarpVaultSC");
const WarpVaultSCFactory = artifacts.require("WarpVaultSCFactory");
const UniswapLPOracleFactory = artifacts.require("UniswapLPOracleFactory");
const UniswapLPOracleInstance = artifacts.require("UniswapLPOracleInstance");
const WarpWrapperToken = artifacts.require("WarpWrapperToken");
const ERC20 = artifacts.require("ERC20");
const TestToken = artifacts.require("TesterToken");

const ONE_DAY = 1000 * 86400;

const getEvent = async (txResult, eventName) => {
  let res = undefined;
  truffleAssert.eventEmitted(txResult, eventName, ev => {
    res = ev;
    return true;
  });
  return res;
};

const getCreatedPair = async txResult => {
  const pairAddress = new Promise(resolve => {
    truffleAssert.eventEmitted(txResult, "PairCreated", ev => {
      resolve(ev.pair);
    });
  });

  return UniswapV2Pair.at(await pairAddress);
};

//await usdcToken.mint(usdcBTCPair.address, conversionRates.usdc.btc * minimumLiquidity);
const giveTokens = async (token, account, amount) => {
  const numDecimals = parseInt((await token.decimals()).toString());
  const oneUnit = (new BigNumber(10)).pow(numDecimals);
  const realAmount = (new BigNumber(amount)).times(oneUnit);
  //console.log(amount, numDecimals, realAmount.toString());
  console.log(await token.symbol(), amount, numDecimals, realAmount.toString());
  await token.mint(account, realAmount.toString());
};

//await giveTokens(usdcToken, usdcBTCPair.address, conversionRates.usdc.btc * minimumLiquidity)
//await giveTokens(wbtcToken, usdcBTCPair.address,  1 / conversionRates.usdc.btc * minimumLiquidity)
const giveEqualTokens = async (account, token0, token1, conversion, amount) => {
  await giveTokens(token0, account, conversion * amount);
  await giveTokens(token1, account, amount);
};

const giveLPTokens = async (
  account,
  lpToken,
  token0,
  token1,
  conversion,
  amount
) => {
  await giveEqualTokens(lpToken.address, token0, token1, conversion, amount);
  await lpToken.mint(account);
};

contract("Setup Test Env", function(accounts) {
  it("Demo", async () => {
    const wbtcToken = await TestToken.new("WBTC", "WBTC");
    const daiToken = await TestToken.new("DAI", "DAI");
    const usdtToken = await TestToken.new("USDT", "USDT");
    usdtToken.setDecimals(6);
    const usdcToken = await TestToken.new("USDC", "USDC");
    usdcToken.setDecimals(6);
    const wethToken = await TestToken.new("WETH", "WETH");

    // Give root some tokens to get things started
    const minimumLiquidity = 1000 * 100;

    // conversionRates[token0][token1] = x
    // X of token0 = token1
    const conversionRates = {
      usdc: {
        btc: 14000,
        usdt: 1,
        dai: 1
      },
      eth: {
        btc: 34,
        usdt: 0.0017,
        usdc: 0.0017,
        dai: 0.0017
      }
    };

    const uniFactory = await UniswapV2Factory.new(accounts[0]);

    /* Pairs for conversions */

    const ethCPair = await getCreatedPair(
      await uniFactory.createPair(usdcToken.address, wethToken.address)
    );
    await giveEqualTokens(
      ethCPair.address,
      wethToken,
      usdcToken,
      conversionRates.eth.usdc,
      minimumLiquidity
    );
    await ethCPair.mint(accounts[0]);

    const usdcDaiPair = await getCreatedPair(
      await uniFactory.createPair(usdcToken.address, daiToken.address)
    );
    await giveEqualTokens(
      usdcDaiPair.address,
      daiToken,
      usdcToken,
      conversionRates.usdc.dai,
      minimumLiquidity
    );
    await usdcDaiPair.mint(accounts[0]);
    

    const uniRouter = await UniswapV2Router02.new(
      uniFactory.address,
      wethToken.address
    );

    await usdcDaiPair.sync();
    await ethCPair.sync();

    await utils.increaseTime(ONE_DAY);

    const ethDaiPair = await getCreatedPair(
      await uniFactory.createPair(daiToken.address, wethToken.address)
    );
    await giveEqualTokens(
      ethDaiPair.address,
      wethToken,
      daiToken,
      conversionRates.eth.dai,
      minimumLiquidity
    );
    await ethDaiPair.mint(accounts[0]);

    await utils.increaseTime(ONE_DAY);
    await usdcDaiPair.sync();
    await utils.increaseTime(ONE_DAY);

    const oracleFactory = await UniswapLPOracleFactory.new(
      usdcToken.address,
      uniFactory.address,
      uniRouter.address
    );

    await oracleFactory.createNewOracles(usdcToken.address, wethToken.address, ethCPair.address);
    await oracleFactory.createNewOracles(usdcToken.address, daiToken.address, usdcDaiPair.address);
    await oracleFactory.createNewOracles(wethToken.address, daiToken.address, ethDaiPair.address);

    const ethCOracle = await UniswapLPOracleInstance.at(await oracleFactory.tokenToUSDC(wethToken.address));
    const daiCOracle = await UniswapLPOracleInstance.at(await oracleFactory.tokenToUSDC(daiToken.address));
    const usdcusdcOracle = await UniswapLPOracleInstance.at(await oracleFactory.tokenToUSDC(usdcToken.address));
    
    await utils.increaseTime(ONE_DAY);
    await ethCOracle.update();
    await daiCOracle.update();
    await utils.increaseTime(ONE_DAY);

    let supply = await ethCPair.totalSupply();
    let reserves = await ethCPair.getReserves();
    console.log("eth price (6 decimals)", (await ethCOracle.viewPrice(wethToken.address, toWei("1"))).toString());
    console.log("usdc price (6 decimals)", (await usdcusdcOracle.viewPrice(usdcToken.address, "1000000")).toString())
    console.log("supply (18 decimals)", supply.toString());
    console.log("reserves: ", reserves[0].toString(), reserves[1].toString());
    let price = await oracleFactory.viewUnderlyingPrice(ethCPair.address);
    console.log("price (6 decimals)", price.toString());

    console.log("-------------------------\n\n")



    console.log( "-------- manual ---------- \n\n");

    let chosenLP = ethCPair;
    let oracleAddresses = [await oracleFactory.LPAssetTracker(chosenLP.address, 0),
      await oracleFactory.LPAssetTracker(chosenLP.address, 1)];
    let oracle1 = await UniswapLPOracleInstance.at(oracleAddresses[0]);
    let oracle2 = await UniswapLPOracleInstance.at(oracleAddresses[1]);

    supply = await chosenLP.totalSupply();
    reserves = await chosenLP.getReserves();

    let price0 = await oracle1.viewPrice(await chosenLP.token0(), reserves[0]);
    let price1 = await oracle2.viewPrice(await chosenLP.token1(), reserves[1]);

    console.log("price0", price0.toString())
    console.log("price1", price1.toString());
    let combinedValue = price0.add(price1);
    console.log("price0 + price1", combinedValue.toString());
    console.log("price per LP", (await oracleFactory.viewUnderlyingPrice(chosenLP.address)).toString());


    console.log( "-------- manual (eth-dai) ---------- \n\n");

    chosenLP = ethDaiPair;
    oracleAddresses = [await oracleFactory.LPAssetTracker(chosenLP.address, 0),
      await oracleFactory.LPAssetTracker(chosenLP.address, 1)];
    oracle1 = await UniswapLPOracleInstance.at(oracleAddresses[0]);
    oracle2 = await UniswapLPOracleInstance.at(oracleAddresses[1]);

    supply = await chosenLP.totalSupply();
    console.log("supply", supply.toString());
    reserves = await chosenLP.getReserves();
    console.log("reserves", reserves[0].toString(), reserves[1].toString());

    price0 = await oracle1.viewPrice(await chosenLP.token0(), reserves[0]);
    price1 = await oracle2.viewPrice(await chosenLP.token1(), reserves[1]);

    console.log("price0", price0.toString())
    console.log("price1", price1.toString());
    combinedValue = price0.add(price1);
    console.log("price0 + price1", combinedValue.toString());
    console.log("price per LP", (await oracleFactory.viewUnderlyingPrice(chosenLP.address)).toString());
  });
});
