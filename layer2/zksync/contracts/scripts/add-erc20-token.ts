import { ArgumentParser } from 'argparse';
import { BigNumber, Wallet, ethers } from 'ethers';
import { Deployer } from '../src.ts/deploy';
import * as fs from 'fs';
import * as path from 'path';

const provider = new ethers.providers.JsonRpcProvider(process.env.WEB3_URL);
const testConfigPath = path.join(process.env.ZKSYNC_HOME as string, `etc/test_config/constant`);
const ethTestConfig = JSON.parse(fs.readFileSync(`${testConfigPath}/eth.json`, { encoding: 'utf-8' }));

async function main() {
    const parser = new ArgumentParser({
        version: '0.1.0',
        addHelp: true,
        description: 'Add erc20 token to the governance'
    });

    parser.addArgument('--tokenAddress', { required: true, help: 'Address erc20 token' });
    parser.addArgument('--deployerPrivateKey', { required: false, help: 'Wallet used to deploy contracts' });

    const args = parser.parseArgs(process.argv.slice(2));

    const deployer = new Deployer({ deployWallet: ethers.Wallet.createRandom() });

    const governorWallet = args.deployerPrivateKey
        ? new Wallet(args.deployerPrivateKey, provider)
        : Wallet.fromMnemonic(ethTestConfig.MNEMONIC, "m/44'/60'/0'/0/1").connect(provider);

    console.log('Adding new ERC20 token to network: ', args.tokenAddress);

    const tx = await deployer
        .governanceContract(governorWallet)
        .addToken(args.tokenAddress, { gasLimit: BigNumber.from('1000000') });
    console.log('tx hash: ', tx.hash);
    const receipt = await tx.wait();
    console.log('status: ', receipt.status);
}

main();
