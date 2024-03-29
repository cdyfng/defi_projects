import { ChainId } from '@0x/contract-addresses';
import { BlockParam, ContractAddresses, GethCallOverrides } from '@0x/contract-wrappers';
import { TakerRequestQueryParams } from '@0x/quote-server';
import { SignedOrder } from '@0x/types';
import { BigNumber } from '@0x/utils';

import {
    ERC20BridgeSource,
    GetMarketOrdersOpts,
    LiquidityProviderRegistry,
    OptimizedMarketOrder,
    TokenAdjacencyGraph,
} from './utils/market_operation_utils/types';
import { QuoteReport } from './utils/quote_report_generator';

/**
 * expiryBufferMs: The number of seconds to add when calculating whether an order is expired or not. Defaults to 300s (5m).
 * permittedOrderFeeTypes: A set of all the takerFee types that OrderPruner will filter for
 */
export interface OrderPrunerOpts {
    expiryBufferMs: number;
    permittedOrderFeeTypes: Set<OrderPrunerPermittedFeeTypes>;
}

/**
 * Represents the on-chain metadata of a signed order
 */
export interface OrderPrunerOnChainMetadata {
    orderStatus: number;
    orderHash: string;
    orderTakerAssetFilledAmount: BigNumber;
    fillableTakerAssetAmount: BigNumber;
    isValidSignature: boolean;
}

/**
 * makerAssetData: The assetData representing the desired makerAsset.
 * takerAssetData: The assetData representing the desired takerAsset.
 */
export interface OrderProviderRequest {
    makerAssetData: string;
    takerAssetData: string;
}

/**
 * fillableMakerAssetAmount: Amount of makerAsset that is fillable
 * fillableTakerAssetAmount: Amount of takerAsset that is fillable
 * fillableTakerFeeAmount: Amount of takerFee paid to fill fillableTakerAssetAmount
 */
export interface SignedOrderWithFillableAmounts extends SignedOrder {
    fillableMakerAssetAmount: BigNumber;
    fillableTakerAssetAmount: BigNumber;
    fillableTakerFeeAmount: BigNumber;
}

/**
 * Represents the metadata to call a smart contract with calldata.
 * calldataHexString: The hexstring of the calldata.
 * toAddress: The contract address to call.
 * ethAmount: The eth amount in wei to send with the smart contract call.
 * allowanceTarget: The address the taker should grant an allowance to.
 */
export interface CalldataInfo {
    calldataHexString: string;
    toAddress: string;
    ethAmount: BigNumber;
    allowanceTarget: string;
}

/**
 * Represents the varying smart contracts that can consume a valid swap quote
 */
export enum ExtensionContractType {
    None = 'NONE',
    Forwarder = 'FORWARDER',
    ExchangeProxy = 'EXCHANGE_PROXY',
}

/**
 * feePercentage: Optional affiliate fee percentage used to calculate the eth amount paid to fee recipient.
 * feeRecipient: The address where affiliate fees are sent. Defaults to null address (0x000...000).
 */
export interface ForwarderSmartContractParamsBase {
    feePercentage: BigNumber;
    feeRecipient: string;
}

/**
 * Interface that varying SwapQuoteConsumers adhere to (exchange consumer, router consumer, forwarder consumer, coordinator consumer)
 * getCalldataOrThrow: Get CalldataInfo to swap for tokens with provided SwapQuote. Throws if invalid SwapQuote is provided.
 * executeSwapQuoteOrThrowAsync: Executes a web3 transaction to swap for tokens with provided SwapQuote. Throws if invalid SwapQuote is provided.
 */
export interface SwapQuoteConsumerBase {
    getCalldataOrThrowAsync(quote: SwapQuote, opts: Partial<SwapQuoteGetOutputOpts>): Promise<CalldataInfo>;
    executeSwapQuoteOrThrowAsync(quote: SwapQuote, opts: Partial<SwapQuoteExecutionOpts>): Promise<string>;
}

/**
 * chainId: The chainId that the desired orders should be for.
 */
export interface SwapQuoteConsumerOpts {
    chainId: number;
    contractAddresses?: ContractAddresses;
}

/**
 * Represents the options provided to a generic SwapQuoteConsumer
 */
export interface SwapQuoteGetOutputOpts {
    useExtensionContract: ExtensionContractType;
    extensionContractOpts?: ForwarderExtensionContractOpts | ExchangeProxyContractOpts | any;
}

/**
 * ethAmount: The amount of eth sent with the execution of a swap.
 * takerAddress: The address to perform the buy. Defaults to the first available address from the provider.
 * gasLimit: The amount of gas to send with a transaction (in Gwei). Defaults to an eth_estimateGas rpc call.
 */
export interface SwapQuoteExecutionOpts extends SwapQuoteGetOutputOpts {
    ethAmount?: BigNumber;
    takerAddress?: string;
    gasLimit?: number;
}

/**
 * feePercentage: percentage (up to 5%) of the taker asset paid to feeRecipient
 * feeRecipient: address of the receiver of the feePercentage of taker asset
 */
export interface ForwarderExtensionContractOpts {
    feePercentage: number;
    feeRecipient: string;
}

export interface AffiliateFee {
    recipient: string;
    buyTokenFeeAmount: BigNumber;
    sellTokenFeeAmount: BigNumber;
}

/**
 * Automatically resolved protocol fee refund receiver addresses.
 */
export enum ExchangeProxyRefundReceiver {
    // Refund to the taker address.
    Taker = '0x0000000000000000000000000000000000000001',
    // Refund to the sender address.
    Sender = '0x0000000000000000000000000000000000000002',
}

/**
 * @param isFromETH Whether the input token is ETH.
 * @param isToETH Whether the output token is ETH.
 * @param affiliateFee Fee denominated in taker or maker asset to send to specified recipient.
 * @param refundReceiver The receiver of unspent protocol fees.
 *        May be a valid address or one of:
 *        `address(0)`: Stay in flash wallet.
 *        `address(1)`: Send to the taker.
 *        `address(2)`: Send to the sender (caller of `transformERC20()`).
 * @param shouldSellEntireBalance Whether the entire balance of the caller should be sold. Used
 *        for contracts where the balance at transaction time is different to the quote amount.
 *        This foregos certain VIP routes which do not support this feature.
 */
export interface ExchangeProxyContractOpts {
    isFromETH: boolean;
    isToETH: boolean;
    affiliateFee: AffiliateFee;
    refundReceiver: string | ExchangeProxyRefundReceiver;
    isMetaTransaction: boolean;
    shouldSellEntireBalance: boolean;
}

export interface GetExtensionContractTypeOpts {
    takerAddress?: string;
    ethAmount?: BigNumber;
}

/**
 * takerAssetData: String that represents a specific taker asset (for more info: https://github.com/0xProject/0x-protocol-specification/blob/master/v2/v2-specification.md).
 * makerAssetData: String that represents a specific maker asset (for more info: https://github.com/0xProject/0x-protocol-specification/blob/master/v2/v2-specification.md).
 * gasPrice: gas price used to determine protocolFee amount, default to ethGasStation fast amount.
 * orders: An array of objects conforming to OptimizedMarketOrder. These orders can be used to cover the requested assetBuyAmount plus slippage.
 * bestCaseQuoteInfo: Info about the best case price for the asset.
 * worstCaseQuoteInfo: Info about the worst case price for the asset.
 * unoptimizedQuoteInfo: Info about the unoptimized (best single source) price for the swap
 * unoptimizedOrders: Orders used in the unoptimized quote info
 */
export interface SwapQuoteBase {
    takerAssetData: string;
    makerAssetData: string;
    gasPrice: BigNumber;
    orders: OptimizedMarketOrder[];
    bestCaseQuoteInfo: SwapQuoteInfo;
    worstCaseQuoteInfo: SwapQuoteInfo;
    sourceBreakdown: SwapQuoteOrdersBreakdown;
    quoteReport?: QuoteReport;
    unoptimizedQuoteInfo: SwapQuoteInfo;
    unoptimizedOrders: OptimizedMarketOrder[];
    isTwoHop: boolean;
    makerTokenDecimals: number;
    takerTokenDecimals: number;
    takerAssetToEthRate: BigNumber;
    makerAssetToEthRate: BigNumber;
}

/**
 * takerAssetFillAmount: The amount of takerAsset sold for makerAsset.
 * type: Specified MarketOperation the SwapQuote is provided for
 */
export interface MarketSellSwapQuote extends SwapQuoteBase {
    takerAssetFillAmount: BigNumber;
    type: MarketOperation.Sell;
}

/**
 * makerAssetFillAmount: The amount of makerAsset bought with takerAsset.
 * type: Specified MarketOperation the SwapQuote is provided for
 */
export interface MarketBuySwapQuote extends SwapQuoteBase {
    makerAssetFillAmount: BigNumber;
    type: MarketOperation.Buy;
}

export type SwapQuote = MarketBuySwapQuote | MarketSellSwapQuote;

/**
 * feeTakerAssetAmount: The amount of takerAsset reserved for paying takerFees when swapping for desired assets.
 * takerAssetAmount: The amount of takerAsset swapped for desired makerAsset.
 * totalTakerAssetAmount: The total amount of takerAsset required to complete the swap (filling orders, and paying takerFees).
 * makerAssetAmount: The amount of makerAsset that will be acquired through the swap.
 * protocolFeeInWeiAmount: The amount of ETH to pay (in WEI) as protocol fee to perform the swap for desired asset.
 * gas: Amount of estimated gas needed to fill the quote.
 */
export interface SwapQuoteInfo {
    feeTakerAssetAmount: BigNumber;
    takerAssetAmount: BigNumber;
    totalTakerAssetAmount: BigNumber;
    makerAssetAmount: BigNumber;
    protocolFeeInWeiAmount: BigNumber;
    gas: number;
}

/**
 * percentage breakdown of each liquidity source used in quote
 */
export type SwapQuoteOrdersBreakdown = Partial<
    { [key in Exclude<ERC20BridgeSource, typeof ERC20BridgeSource.MultiHop>]: BigNumber } & {
        [ERC20BridgeSource.MultiHop]: {
            proportion: BigNumber;
            intermediateToken: string;
            hops: ERC20BridgeSource[];
        };
    }
>;

export interface PriceAwareRFQFlags {
    isIndicativePriceAwareEnabled: boolean;
    isFirmPriceAwareEnabled: boolean;
}

/**
 * nativeExclusivelyRFQT: if set to `true`, Swap quote will exclude Open Orderbook liquidity.
 *                        If set to `true` and `ERC20BridgeSource.Native` is part of the `excludedSources`
 *                        array in `SwapQuoteRequestOpts`, an Error will be raised.
 */
export interface RfqtRequestOpts {
    takerAddress: string;
    apiKey: string;
    intentOnFilling: boolean;
    isIndicative?: boolean;
    makerEndpointMaxResponseTimeMs?: number;
    nativeExclusivelyRFQT?: boolean;

    /**
     * This feature flag allows us to merge the price-aware RFQ pricing
     * project while still controlling when to activate the feature. We plan to do some
     * data analysis work and address some of the issues with maker fillable amounts
     * in later milestones. Once the feature is fully rolled out and is providing value
     * and we have assessed that there is no user impact, we will proceed in cleaning up
     * the feature flag.  When that time comes, follow this PR to "undo" the feature flag:
     * https://github.com/0xProject/0x-monorepo/pull/2735
     */
    priceAwareRFQFlag?: PriceAwareRFQFlags;
}

/**
 * gasPrice: gas price to determine protocolFee amount, default to ethGasStation fast amount
 */
export interface SwapQuoteRequestOpts extends CalculateSwapQuoteOpts {
    gasPrice?: BigNumber;
    rfqt?: RfqtRequestOpts;
}

/**
 * Opts required to generate a SwapQuote with SwapQuoteCalculator
 */
export interface CalculateSwapQuoteOpts extends GetMarketOrdersOpts {}

/**
 * A mapping from RFQ-T quote provider URLs to the trading pairs they support.
 * The value type represents an array of supported asset pairs, with each array element encoded as a 2-element array of token addresses.
 */
export interface RfqtMakerAssetOfferings {
    [endpoint: string]: Array<[string, string]>;
}

export type LogFunction = (obj: object, msg?: string, ...args: any[]) => void;

export interface RfqtFirmQuoteValidator {
    getRfqtTakerFillableAmountsAsync(quotes: SignedOrder[]): Promise<BigNumber[]>;
}

export interface SwapQuoterRfqtOpts {
    takerApiKeyWhitelist: string[];
    makerAssetOfferings: RfqtMakerAssetOfferings;
    warningLogger?: LogFunction;
    infoLogger?: LogFunction;
}

export type AssetSwapperContractAddresses = ContractAddresses & BridgeContractAddresses;

/**
 * chainId: The ethereum chain id. Defaults to 1 (mainnet).
 * orderRefreshIntervalMs: The interval in ms that getBuyQuoteAsync should trigger an refresh of orders and order states. Defaults to 10000ms (10s).
 * expiryBufferMs: The number of seconds to add when calculating whether an order is expired or not. Defaults to 300s (5m).
 * contractAddresses: Optionally override the contract addresses used for the chain
 * samplerGasLimit: The gas limit used when querying the sampler contract. Defaults to 36e6
 */
export interface SwapQuoterOpts extends OrderPrunerOpts {
    chainId: ChainId;
    orderRefreshIntervalMs: number;
    expiryBufferMs: number;
    ethereumRpcUrl?: string;
    contractAddresses?: AssetSwapperContractAddresses;
    samplerGasLimit?: number;
    multiBridgeAddress?: string;
    ethGasStationUrl?: string;
    rfqt?: SwapQuoterRfqtOpts;
    samplerOverrides?: SamplerOverrides;
    tokenAdjacencyGraph?: TokenAdjacencyGraph;
    liquidityProviderRegistry?: LiquidityProviderRegistry;
}

/**
 * Possible error messages thrown by an SwapQuoterConsumer instance or associated static methods.
 */
export enum SwapQuoteConsumerError {
    InvalidMarketSellOrMarketBuySwapQuote = 'INVALID_MARKET_BUY_SELL_SWAP_QUOTE',
    InvalidForwarderSwapQuote = 'INVALID_FORWARDER_SWAP_QUOTE_PROVIDED',
    NoAddressAvailable = 'NO_ADDRESS_AVAILABLE',
    SignatureRequestDenied = 'SIGNATURE_REQUEST_DENIED',
    TransactionValueTooLow = 'TRANSACTION_VALUE_TOO_LOW',
}

/**
 * Possible error messages thrown by an SwapQuoter instance or associated static methods.
 */
export enum SwapQuoterError {
    NoEtherTokenContractFound = 'NO_ETHER_TOKEN_CONTRACT_FOUND',
    StandardRelayerApiError = 'STANDARD_RELAYER_API_ERROR',
    InsufficientAssetLiquidity = 'INSUFFICIENT_ASSET_LIQUIDITY',
    AssetUnavailable = 'ASSET_UNAVAILABLE',
    NoGasPriceProvidedOrEstimated = 'NO_GAS_PRICE_PROVIDED_OR_ESTIMATED',
    AssetDataUnsupported = 'ASSET_DATA_UNSUPPORTED',
}

/**
 * Represents available liquidity for a given assetData.
 */
export interface LiquidityForTakerMakerAssetDataPair {
    makerAssetAvailableInBaseUnits: BigNumber;
    takerAssetAvailableInBaseUnits: BigNumber;
}

/**
 * Represents two main market operations supported by asset-swapper.
 */
export enum MarketOperation {
    Sell = 'Sell',
    Buy = 'Buy',
}

/**
 * Represents varying order takerFee types that can be pruned for by OrderPruner.
 */
export enum OrderPrunerPermittedFeeTypes {
    NoFees = 'NO_FEES',
    MakerDenominatedTakerFee = 'MAKER_DENOMINATED_TAKER_FEE',
    TakerDenominatedTakerFee = 'TAKER_DENOMINATED_TAKER_FEE',
}

/**
 * Represents a mocked RFQT maker responses.
 */
export interface MockedRfqtFirmQuoteResponse {
    endpoint: string;
    requestApiKey: string;
    requestParams: TakerRequestQueryParams;
    responseData: any;
    responseCode: number;
}

/**
 * Represents a mocked RFQT maker responses.
 */
export interface MockedRfqtIndicativeQuoteResponse {
    endpoint: string;
    requestApiKey: string;
    requestParams: TakerRequestQueryParams;
    responseData: any;
    responseCode: number;
}

export interface SamplerOverrides {
    overrides: GethCallOverrides;
    block: BlockParam;
}

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/**
 * The Contract addresses of the deployed Bridges
 */
export interface BridgeContractAddresses {
    uniswapBridge: string;
    uniswapV2Bridge: string;
    eth2DaiBridge: string;
    kyberBridge: string;
    curveBridge: string;
    multiBridge: string;
    balancerBridge: string;
    bancorBridge: string;
    mStableBridge: string;
    mooniswapBridge: string;
    sushiswapBridge: string;
    shellBridge: string;
    dodoBridge: string;
    creamBridge: string;
    swerveBridge: string;
    snowswapBridge: string;
    cryptoComBridge: string;
}
