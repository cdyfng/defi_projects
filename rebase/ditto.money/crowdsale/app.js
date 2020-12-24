const IS_TESTNET = ~window.location.href.indexOf('testnet')
const CONTRACT_ADDRESS = IS_TESTNET
  ? '0xB5198CeC249A98c29250c0E62D45749e20feC307'
  : '0xdA0B550bB87BCC64AA177Fc88c23902DC01Da6aa'
const REQUIRED_CHAIN_ID = IS_TESTNET ? 97 : 56
const TRUST_WALLET_BUG_CHAIN_ID = 86
const READ_WEB3_PROVIDER = new ethers.providers.JsonRpcProvider(
  IS_TESTNET
    ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
    : 'https://bsc-dataseed1.binance.org:443'
)
const INFURA_ID = '1e8cc8aac2bd47f98da31fd2846d6132'

toFormat(Big)

let ABI, READ_CONTRACT, WRITE_CONTRACT, WRITE_WEB3_PROVIDER
let LOADING = false
let IS_ACTIVE = false

$(async () => {
  //   $(window).on('load', async () => {
  await load()
  ethereum.on('accountsChanged', async function (accounts) {
    window.location.reload()
  })

  $('#connect-wallet-btn').click(connectWallet)
  $('#buy-btn').click(buyTokens)
  $('#input-amount').keyup(calculateReceiveAmount)
  $('#connect-metamask').click(connectMetamask)
  $('#connect-trust').click(connectMetamask)
  $('#connect-wallet-connect').click(connectWalletConnect)
  $('#connect-bsc').click(connectBsc)
  $('#connect-wallets .close').click(closeWallets)
  // })
})

async function load() {
  await loadReadContract()
  // await loadAccount()
  // await loadContract()
  await render()
}

async function loadReadContract() {
  ABI = await $.getJSON('CrowdSale.json')

  READ_CONTRACT = new ethers.Contract(CONTRACT_ADDRESS, ABI, READ_WEB3_PROVIDER)
}

async function loadWriteContract() {
  WRITE_CONTRACT = new ethers.Contract(
    CONTRACT_ADDRESS,
    ABI,
    WRITE_WEB3_PROVIDER.getSigner()
  )
}

function showWallets() {
  $('#connect-wallets').removeClass('hidden')
}

function closeWallets() {
  $('#connect-wallets').addClass('hidden')
}

async function connectWallet() {
  showWallets()
}

async function connectMetamask() {
  if (!window.ethereum)
    return sl('error', 'Please install the Metamask extension')
  await window.ethereum.enable()
  closeWallets()
  await loadAccount(window.ethereum)
}

async function connectWalletConnect() {
  const walletConnectProvider = new WalletConnectProvider.default({
    infuraId: INFURA_ID,
  })
  await walletConnectProvider.enable()
  closeWallets()
  await loadAccount(walletConnectProvider)
}

async function connectBsc() {
  if (!window.BinanceChain)
    return sl('error', 'Please install the Binance Wallet extension')
  await window.BinanceChain.enable()
  closeWallets()
  await loadAccount(window.BinanceChain)
}

async function loadAccount(p) {
  const provider = new ethers.providers.Web3Provider(p)
  const net = await provider.getNetwork()
  if (!~[REQUIRED_CHAIN_ID, TRUST_WALLET_BUG_CHAIN_ID].indexOf(net.chainId)) {
    if (p.disconnect) {
      p.disconnect()
    }
    const {isConfirmed: showGuide} = await Swal.fire({
      icon: 'error',
      title: 'You are connected to the wrong network',
      text: `Here's a guide on how to connect to the correct one: Binance Smart Chain ${
        IS_TESTNET ? 'Testnet' : 'Mainnet'
      }`,
      showCancelButton: true,
      confirmButtonText: 'Show Guide',
    })
    if (showGuide) {
      window.open(
        'https://www.binance.com/en/blog/421499824684901055/Get-Started-on-Binance-Smart-Chain-in-60-Seconds'
      )
    }
    return
  }
  WRITE_WEB3_PROVIDER = provider

  await loadWriteContract()

  render()
}

async function render() {
  if (LOADING) {
    return
  }

  setLoading(true)
  await Promise.all([setAddress(), checkIsActive(), setRemainingTokens()])
  toggleBuyButton()
  setLoading(false)
}

async function setAddress() {
  if (WRITE_WEB3_PROVIDER) {
    ADDRESS = await WRITE_WEB3_PROVIDER.getSigner().getAddress()
    $('#account').html(
      `${ADDRESS.substring(0, 6)}...${ADDRESS.substring(
        ADDRESS.length - 4,
        ADDRESS.length
      )}`
    )
  }
}

async function checkIsActive() {
  IS_ACTIVE = await READ_CONTRACT.isSaleActive()
}

async function setRemainingTokens() {
  const remainingTokens = toHumanizedCurrency(
    new Big((await READ_CONTRACT.remainingTokens()).toString()).div(
      new Big(1e9)
    )
  )
  $('#remainingTokens').html(remainingTokens)
}

async function calculateReceiveAmount() {
  let inputAmount = $('#input-amount').val()
  if (inputAmount) {
    const inputAmountInWei = ethers.utils.parseEther(inputAmount)
    if (inputAmountInWei.isZero()) {
      return
    }
    try {
      const receiveAmount = toHumanizedCurrency(
        new Big(
          (await READ_CONTRACT._getTokenAmount(inputAmountInWei)).toString()
        ).div(new Big(1e9))
      )
      $('#receive-amount').val(receiveAmount)
    } catch (error) {
      console.error(error)
      sl('error', 'An error occurred. Please see the console!')
      $('#receive-amount').val('')
    }
  } else {
    $('#receive-amount').val('')
  }
}

async function buyTokens() {
  if (!IS_ACTIVE) {
    return sl('error', 'Sale is not active.')
  }
  let inputAmount = $('#input-amount').val()
  if (inputAmount) {
    let inputAmountInWei = ethers.utils.parseEther(inputAmount)
    try {
      setLoading(true, true)
      await WRITE_CONTRACT.buyTokens(ADDRESS, {
        value: inputAmountInWei,
      })
      setLoading(false)
      sl(
        'success',
        'You will receive your tokens once the transaction has been mined..'
      )
      $('input').trigger('reset')
    } catch (error) {
      console.error(error)
      sl('error', 'An error occurred. Please see the console!')
      setLoading(false)
    }
  } else {
    return
  }
}

function toggleBuyButton() {
  if (WRITE_WEB3_PROVIDER) {
    $('#connect-wallet-btn').hide()
    $('#buy-btn').show()
  } else {
    $('#connect-wallet-btn').show()
    $('#buy-btn').hide()
  }
  if (!IS_ACTIVE) {
    $('#buy-btn').text('Sale is not active')
  }
}

function setLoading(loading, txnProcessing = false) {
  LOADING = loading

  if (LOADING) {
    $('#loader').show()
    $('#content').hide()
    if (txnProcessing) {
      $('#txn-processing-msg').show()
    }
  } else {
    $('#loader').hide()
    $('#txn-processing-msg').hide()
    $('#content').show()
  }
}

function sl(type, msg) {
  Swal.fire({
    icon: type,
    text: msg,
  })
}

function toHumanizedCurrency(val) {
  if (val.toNumber) {
    return new Big(val.toString()).toFormat(2)
  }
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'})
    .format(val)
    .replace('$', '')
}
