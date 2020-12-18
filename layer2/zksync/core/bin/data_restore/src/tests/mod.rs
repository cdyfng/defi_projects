pub(crate) mod utils;

use std::cmp::max;
use std::{collections::HashMap, future::Future};

use chrono::Utc;
use futures::future;
use jsonrpc_core::Params;
use num::BigUint;
use serde_json::{json, Value};
use web3::types::Bytes;
use web3::{contract::tokens::Tokenize, types::Transaction, RequestId, Transport};

use db_test_macro::test as db_test;
use zksync_contracts::{governance_contract, zksync_contract};
use zksync_crypto::Fr;
use zksync_storage::{
    chain::account::AccountSchema, data_restore::DataRestoreSchema, StorageProcessor,
};
use zksync_types::{
    block::Block, Address, Deposit, DepositOp, ExecutedOperations, ExecutedPriorityOp, ExecutedTx,
    Log, PriorityOp, Withdraw, WithdrawOp, ZkSyncOp, H256,
};

use crate::{
    data_restore_driver::DataRestoreDriver,
    database_storage_interactor::DatabaseStorageInteractor,
    inmemory_storage_interactor::InMemoryStorageInteractor,
    tests::utils::{create_log, u32_to_32bytes},
    END_ETH_BLOCKS_OFFSET, ETH_BLOCKS_STEP,
};

fn create_withdraw_operations(
    account_id: u32,
    from: Address,
    to: Address,
    amount: u32,
) -> ExecutedOperations {
    let withdraw_op = ZkSyncOp::Withdraw(Box::new(WithdrawOp {
        tx: Withdraw::new(account_id, from, to, 0, amount.into(), 0u32.into(), 0, None),
        account_id,
    }));
    let executed_tx = ExecutedTx {
        signed_tx: withdraw_op.try_get_tx().unwrap().into(),
        success: false,
        op: Some(withdraw_op),
        fail_reason: None,
        block_index: None,
        created_at: Utc::now(),
        batch_id: None,
    };
    ExecutedOperations::Tx(Box::new(executed_tx))
}

fn create_deposit(from: Address, to: Address, amount: u32) -> ExecutedOperations {
    let deposit_op = ZkSyncOp::Deposit(Box::new(DepositOp {
        priority_op: Deposit {
            from,
            token: 0,
            amount: amount.into(),
            to,
        },
        account_id: 0,
    }));
    let priority_operation = PriorityOp {
        serial_id: 0,
        data: deposit_op.try_get_priority_op().unwrap(),
        deadline_block: 0,
        eth_hash: vec![],
        eth_block: 0,
    };
    let executed_deposit_op = ExecutedPriorityOp {
        priority_op: priority_operation,
        op: deposit_op,
        block_index: 0,
        created_at: Utc::now(),
    };
    ExecutedOperations::PriorityOp(Box::new(executed_deposit_op))
}

fn create_block(block_number: u32, transactions: Vec<ExecutedOperations>) -> Block {
    Block::new(
        block_number,
        Fr::default(),
        0,
        transactions,
        (0, 0),
        100,
        1_000_000.into(),
        1_500_000.into(),
    )
}

fn create_transaction(number: u32, block: Block) -> Transaction {
    let hash: H256 = u32_to_32bytes(number).into();
    let root = block.get_eth_encoded_root();
    let public_data = block.get_eth_public_data();
    let witness_data = block.get_eth_witness_data();
    let fake_data = [0u8; 4];
    let params = (
        u64::from(block.block_number),
        u64::from(block.fee_account),
        vec![root],
        public_data,
        witness_data.0,
        witness_data.1,
    );
    let mut input_data = vec![];
    input_data.extend_from_slice(&fake_data);
    input_data.extend_from_slice(&ethabi::encode(params.into_tokens().as_ref()));

    Transaction {
        hash,
        nonce: u32_to_32bytes(1).into(),
        block_hash: Some(u32_to_32bytes(100).into()),
        block_number: Some(block.block_number.into()),
        transaction_index: Some(block.block_number.into()),
        from: [5u8; 20].into(),
        to: Some([7u8; 20].into()),
        value: u32_to_32bytes(10).into(),
        gas_price: u32_to_32bytes(1).into(),
        gas: u32_to_32bytes(1).into(),
        input: Bytes(input_data),
        raw: None,
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Web3Transport {
    transactions: HashMap<String, Transaction>,
    logs: HashMap<String, Vec<Log>>,
    last_block: u32,
}

impl Web3Transport {
    fn new() -> Self {
        Self {
            transactions: HashMap::default(),
            logs: HashMap::default(),
            last_block: 0,
        }
    }
    fn push_transactions(&mut self, transactions: Vec<Transaction>) {
        for transaction in transactions {
            self.last_block = max(transaction.block_number.unwrap().as_u32(), self.last_block);
            self.transactions
                .insert(format!("{:?}", &transaction.hash), transaction);
        }
    }

    fn insert_logs(&mut self, topic: String, logs: Vec<Log>) {
        self.logs.insert(topic, logs);
    }

    fn get_logs(&self, filter: Value) -> Vec<Log> {
        let topics = if let Ok(topics) =
            serde_json::from_value::<Vec<Vec<String>>>(filter.get("topics").unwrap().clone())
        {
            topics.first().unwrap().clone()
        } else {
            serde_json::from_value::<Vec<String>>(filter.get("topics").unwrap().clone()).unwrap()
        };
        let mut logs = vec![];

        for topic in &topics {
            if let Some(topic_logs) = self.logs.get(topic) {
                logs.extend_from_slice(topic_logs)
            }
        }

        logs
    }
}

impl Transport for Web3Transport {
    type Out = Box<dyn Future<Output = Result<jsonrpc_core::Value, web3::Error>> + Send + Unpin>;

    fn prepare(
        &self,
        method: &str,
        params: Vec<jsonrpc_core::Value>,
    ) -> (RequestId, jsonrpc_core::Call) {
        (
            1,
            jsonrpc_core::Call::MethodCall(jsonrpc_core::MethodCall {
                jsonrpc: Some(jsonrpc_core::Version::V2),
                method: method.to_string(),
                params: jsonrpc_core::Params::Array(params),
                id: jsonrpc_core::Id::Num(1),
            }),
        )
    }

    fn send(&self, _id: RequestId, request: jsonrpc_core::Call) -> Self::Out {
        Box::new(future::ready({
            if let jsonrpc_core::Call::MethodCall(req) = request {
                let mut params = if let Params::Array(params) = req.params {
                    params
                } else {
                    unreachable!()
                };
                match req.method.as_str() {
                    "eth_blockNumber" => Ok(json!("0x80")),
                    "eth_getLogs" => {
                        let filter = params.pop().unwrap();
                        Ok(json!(self.get_logs(filter)))
                    }
                    "eth_getTransactionByHash" => {
                        // TODO Cut `"` from start and end of the string
                        let hash = &format!("{}", params.pop().unwrap())[1..67];
                        if let Some(transaction) = self.transactions.get(hash) {
                            Ok(json!(transaction))
                        } else {
                            unreachable!()
                        }
                    }
                    "eth_call" => {
                        // Now it's call only for one function totalVerifiedBlocks later,
                        // if it's necessary, add more complex logic for routing
                        Ok(json!(format!("{:#066x}", self.last_block)))
                    }
                    _ => Err(web3::Error::Unreachable),
                }
            } else {
                Err(web3::Error::Unreachable)
            }
        }))
    }
}

#[db_test]
async fn test_run_state_update(mut storage: StorageProcessor<'_>) {
    let mut transport = Web3Transport::new();

    let mut interactor = DatabaseStorageInteractor::new(storage);
    let contract = zksync_contract();
    let gov_contract = governance_contract();

    let block_verified_topic = contract
        .event("BlockVerification")
        .expect("Main contract abi error")
        .signature();
    let block_verified_topic_string = format!("{:?}", block_verified_topic);
    transport.insert_logs(
        block_verified_topic_string,
        vec![
            create_log(
                block_verified_topic,
                vec![u32_to_32bytes(1).into()],
                Bytes(vec![]),
                1,
                u32_to_32bytes(1).into(),
            ),
            create_log(
                block_verified_topic,
                vec![u32_to_32bytes(2).into()],
                Bytes(vec![]),
                2,
                u32_to_32bytes(2).into(),
            ),
        ],
    );

    let block_committed_topic = contract
        .event("BlockCommit")
        .expect("Main contract abi error")
        .signature();
    let block_commit_topic_string = format!("{:?}", block_committed_topic);
    transport.insert_logs(
        block_commit_topic_string,
        vec![
            create_log(
                block_committed_topic,
                vec![u32_to_32bytes(1).into()],
                Bytes(vec![]),
                1,
                u32_to_32bytes(1).into(),
            ),
            create_log(
                block_committed_topic,
                vec![u32_to_32bytes(2).into()],
                Bytes(vec![]),
                2,
                u32_to_32bytes(2).into(),
            ),
        ],
    );

    let reverted_topic = contract
        .event("BlocksRevert")
        .expect("Main contract abi error")
        .signature();
    let _reverted_topic_string = format!("{:?}", reverted_topic);

    let new_token_topic = gov_contract
        .event("NewToken")
        .expect("Main contract abi error")
        .signature();
    let new_token_topic_string = format!("{:?}", new_token_topic);
    transport.insert_logs(
        new_token_topic_string,
        vec![create_log(
            new_token_topic,
            vec![[0; 32].into(), u32_to_32bytes(3).into()],
            Bytes(vec![]),
            3,
            u32_to_32bytes(1).into(),
        )],
    );

    transport.push_transactions(vec![
        create_transaction(
            1,
            create_block(
                1,
                vec![create_deposit(Default::default(), Default::default(), 50)],
            ),
        ),
        create_transaction(
            2,
            create_block(
                2,
                vec![create_withdraw_operations(
                    0,
                    Default::default(),
                    Default::default(),
                    10,
                )],
            ),
        ),
    ]);

    let mut driver = DataRestoreDriver::new(
        transport.clone(),
        [1u8; 20].into(),
        [1u8; 20].into(),
        ETH_BLOCKS_STEP,
        END_ETH_BLOCKS_OFFSET,
        vec![6, 30],
        true,
        None,
    );
    driver.run_state_update(&mut interactor).await;

    // Check that it's stores some account, created by deposit
    let (_, account) = AccountSchema(interactor.storage())
        .account_state_by_address(&Default::default())
        .await
        .unwrap()
        .verified
        .unwrap();
    let balance = account.get_balance(0);

    assert_eq!(BigUint::from(40u32), balance);
    assert_eq!(driver.events_state.committed_events.len(), 2);
    let events = DataRestoreSchema(interactor.storage())
        .load_committed_events_state()
        .await
        .unwrap();

    assert_eq!(driver.events_state.committed_events.len(), events.len());

    // Nullify the state of driver
    let mut driver = DataRestoreDriver::new(
        transport.clone(),
        [1u8; 20].into(),
        [1u8; 20].into(),
        ETH_BLOCKS_STEP,
        END_ETH_BLOCKS_OFFSET,
        vec![6, 30],
        true,
        None,
    );
    // Load state from db and check it
    assert!(driver.load_state_from_storage(&mut interactor).await);
    assert_eq!(driver.events_state.committed_events.len(), events.len());
    assert_eq!(driver.tree_state.state.block_number, 2)
}

#[tokio::test]
async fn test_with_inmemory_storage() {
    let mut transport = Web3Transport::new();

    let mut interactor = InMemoryStorageInteractor::new();
    let contract = zksync_contract();
    let gov_contract = governance_contract();

    let block_verified_topic = contract
        .event("BlockVerification")
        .expect("Main contract abi error")
        .signature();
    let block_verified_topic_string = format!("{:?}", block_verified_topic);
    transport.insert_logs(
        block_verified_topic_string,
        vec![
            create_log(
                block_verified_topic,
                vec![u32_to_32bytes(1).into()],
                Bytes(vec![]),
                1,
                u32_to_32bytes(1).into(),
            ),
            create_log(
                block_verified_topic,
                vec![u32_to_32bytes(2).into()],
                Bytes(vec![]),
                2,
                u32_to_32bytes(2).into(),
            ),
        ],
    );

    let block_committed_topic = contract
        .event("BlockCommit")
        .expect("Main contract abi error")
        .signature();
    let block_commit_topic_string = format!("{:?}", block_committed_topic);
    transport.insert_logs(
        block_commit_topic_string,
        vec![
            create_log(
                block_committed_topic,
                vec![u32_to_32bytes(1).into()],
                Bytes(vec![]),
                1,
                u32_to_32bytes(1).into(),
            ),
            create_log(
                block_committed_topic,
                vec![u32_to_32bytes(2).into()],
                Bytes(vec![]),
                2,
                u32_to_32bytes(2).into(),
            ),
        ],
    );

    let reverted_topic = contract
        .event("BlocksRevert")
        .expect("Main contract abi error")
        .signature();
    let _reverted_topic_string = format!("{:?}", reverted_topic);

    let new_token_topic = gov_contract
        .event("NewToken")
        .expect("Main contract abi error")
        .signature();
    let new_token_topic_string = format!("{:?}", new_token_topic);
    transport.insert_logs(
        new_token_topic_string,
        vec![create_log(
            new_token_topic,
            vec![[0; 32].into(), u32_to_32bytes(3).into()],
            Bytes(vec![]),
            3,
            u32_to_32bytes(1).into(),
        )],
    );

    transport.push_transactions(vec![
        create_transaction(
            1,
            create_block(
                1,
                vec![create_deposit(Default::default(), Default::default(), 50)],
            ),
        ),
        create_transaction(
            2,
            create_block(
                2,
                vec![create_withdraw_operations(
                    0,
                    Default::default(),
                    Default::default(),
                    10,
                )],
            ),
        ),
    ]);

    let mut driver = DataRestoreDriver::new(
        transport.clone(),
        [1u8; 20].into(),
        [1u8; 20].into(),
        ETH_BLOCKS_STEP,
        END_ETH_BLOCKS_OFFSET,
        vec![6, 30],
        true,
        None,
    );
    driver.run_state_update(&mut interactor).await;

    // Check that it's stores some account, created by deposit
    let (_, account) = interactor
        .get_account_by_address(&Default::default())
        .unwrap();
    let balance = account.get_balance(0);

    assert_eq!(BigUint::from(40u32), balance);
    assert_eq!(driver.events_state.committed_events.len(), 2);
    let events = interactor.load_committed_events_state();

    assert_eq!(driver.events_state.committed_events.len(), events.len());

    // Nullify the state of driver
    let mut driver = DataRestoreDriver::new(
        transport.clone(),
        [1u8; 20].into(),
        [1u8; 20].into(),
        ETH_BLOCKS_STEP,
        END_ETH_BLOCKS_OFFSET,
        vec![6, 30],
        true,
        None,
    );
    // Load state from db and check it
    assert!(driver.load_state_from_storage(&mut interactor).await);
    assert_eq!(driver.events_state.committed_events.len(), events.len());
    assert_eq!(driver.tree_state.state.block_number, 2)
}
