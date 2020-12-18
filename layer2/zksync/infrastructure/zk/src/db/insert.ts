import { Command } from 'commander';
import * as utils from '../utils';
import * as env from '../env';
import fetch from 'node-fetch';

const SQL = () => `psql "${process.env.DATABASE_URL}" -c`;

export async function token(id: string, address: string, symbol: string, precison: string) {
    // force read env
    env.reload();
    await utils.exec(`${SQL()} "INSERT INTO tokens VALUES (${id}, '${address}', '${symbol}', ${precison});"`);
    console.log('Successfully inserted token into the database');
}

export async function contract() {
    // force read env
    env.reload();
    const contractAddress = process.env.CONTRACT_ADDR;
    const governanceAddress = process.env.GOVERNANCE_ADDR;
    await utils.exec(`${SQL()} "INSERT INTO server_config (contract_addr, gov_contract_addr)
					 VALUES ('${contractAddress}', '${governanceAddress}')
					 ON CONFLICT (id) DO UPDATE
					 SET (contract_addr, gov_contract_addr) = ('${contractAddress}', '${governanceAddress}')"`);
    console.log('Successfully inserted contract address into the database');
}

export async function ethData() {
    // force read env
    env.reload();

    const body = {
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: [process.env.OPERATOR_COMMIT_ETH_ADDRESS as string, 'pending'],
        id: 1
    };
    const reponse = await fetch(process.env.WEB3_URL as string, {
        method: 'post',
        body: JSON.stringify(body),
        headers: {
            Accept: 'application/json',
            'Content-type': 'application/json'
        }
    });
    const nonce = parseInt((await reponse.json()).result);
    await utils.exec(`${SQL()} "INSERT INTO eth_parameters (nonce, gas_price_limit, commit_ops, verify_ops, withdraw_ops)
                     VALUES ('${nonce}', '${process.env.ETH_GAS_PRICE_DEFAULT_LIMIT}', 0, 0, 0)
                     ON CONFLICT (id) DO UPDATE SET (commit_ops, verify_ops, withdraw_ops) = (0, 0, 0)"`);
}

export const command = new Command('insert').description('insert pre-defined data into the database');

command.command('contract').description('insert contract addresses').action(contract);
command.command('token <id> <address> <symbol> <precision>').description('insert token information').action(token);
command.command('eth-data').description('insert info about Ethereum blockchain').action(ethData);
