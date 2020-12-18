// Local uses
use self::mock::{
    concurrent_eth_sender, create_signed_tx, create_signed_withdraw_tx, default_eth_sender,
    restored_eth_sender,
};
use super::{
    transactions::{ETHStats, ExecutedTxStatus, TxCheckOutcome},
    ETHSender, TxCheckMode,
};

const EXPECTED_WAIT_TIME_BLOCKS: u64 = 30;
const WAIT_CONFIRMATIONS: u64 = 3;

pub mod mock;
mod test_data;

/// Basic test that `ETHSender` creation does not panic and initializes correctly.
#[tokio::test]
async fn basic_test() {
    let eth_sender = default_eth_sender().await;

    // Check that there are no unconfirmed operations by default.
    assert!(eth_sender.ongoing_ops.is_empty());
}

/// Checks that deadline block is chosen according to the expected policy.
#[tokio::test]
async fn deadline_block() {
    let eth_sender = default_eth_sender().await;

    assert_eq!(eth_sender.get_deadline_block(0), EXPECTED_WAIT_TIME_BLOCKS);
    assert_eq!(
        eth_sender.get_deadline_block(10),
        10 + EXPECTED_WAIT_TIME_BLOCKS
    );
}

/// Checks that received transaction response is reduced to the
/// `TxCheckOutcome` correctly.
///
/// Here we check every possible output of the `check_transaction_state` method.
#[tokio::test]
async fn transaction_state() {
    let mut eth_sender = default_eth_sender().await;
    let current_block = eth_sender.ethereum.block_number;
    let deadline_block = eth_sender.get_deadline_block(current_block);
    let operations = vec![
        test_data::commit_operation(0), // Will be committed.
        test_data::commit_operation(1), // Will be pending because of not enough confirmations.
        test_data::commit_operation(2), // Will be failed.
        test_data::commit_operation(3), // Will be failed and pending (not enough confirmations).
        test_data::commit_operation(4), // Will be stuck.
        test_data::commit_operation(5), // Will be pending due no response.
    ];
    let mut eth_operations = Vec::with_capacity(operations.len());

    for (eth_op_id, op) in operations.iter().enumerate() {
        eth_operations.push(
            create_signed_tx(
                eth_op_id as i64,
                &eth_sender,
                op,
                deadline_block,
                eth_op_id as i64,
            )
            .await,
        )
    }

    // Committed operation.
    let committed_response = ExecutedTxStatus {
        confirmations: WAIT_CONFIRMATIONS,
        success: true,
        receipt: None,
    };
    eth_sender
        .ethereum
        .add_execution(&eth_operations[0].used_tx_hashes[0], &committed_response)
        .await;

    // Pending operation.
    let pending_response = ExecutedTxStatus {
        confirmations: WAIT_CONFIRMATIONS - 1,
        success: true,
        receipt: None,
    };
    eth_sender
        .ethereum
        .add_execution(&eth_operations[1].used_tx_hashes[0], &pending_response)
        .await;

    // Failed operation.
    let failed_response = ExecutedTxStatus {
        confirmations: WAIT_CONFIRMATIONS,
        success: false,
        receipt: Some(Default::default()),
    };
    eth_sender
        .ethereum
        .add_execution(&eth_operations[2].used_tx_hashes[0], &failed_response)
        .await;

    // Pending failed operation.
    let pending_failed_response = ExecutedTxStatus {
        confirmations: WAIT_CONFIRMATIONS - 1,
        success: false,
        receipt: Some(Default::default()),
    };
    eth_sender
        .ethereum
        .add_execution(
            &eth_operations[3].used_tx_hashes[0],
            &pending_failed_response,
        )
        .await;

    // Committed operation.
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Latest,
                &eth_operations[0],
                &eth_operations[0].used_tx_hashes[0],
                current_block + committed_response.confirmations,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Committed
    );

    // Pending operation (no enough confirmations).
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Latest,
                &eth_operations[1],
                &eth_operations[1].used_tx_hashes[0],
                current_block + pending_response.confirmations,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Pending
    );

    // Failed operation.
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Latest,
                &eth_operations[2],
                &eth_operations[2].used_tx_hashes[0],
                current_block + failed_response.confirmations,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Failed(Default::default())
    );

    // Pending failed operation should be considered as pending.
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Latest,
                &eth_operations[3],
                &eth_operations[3].used_tx_hashes[0],
                current_block + pending_failed_response.confirmations,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Pending
    );

    // Stuck operation.
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Latest,
                &eth_operations[4],
                &eth_operations[4].used_tx_hashes[0],
                current_block + EXPECTED_WAIT_TIME_BLOCKS,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Stuck
    );

    // Pending operation (no response yet).
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Latest,
                &eth_operations[5],
                &eth_operations[5].used_tx_hashes[0],
                current_block + EXPECTED_WAIT_TIME_BLOCKS - 1,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Pending
    );

    // Pending old operation should be considered stuck.
    assert_eq!(
        eth_sender
            .check_transaction_state(
                TxCheckMode::Old,
                &eth_operations[5],
                &eth_operations[5].used_tx_hashes[0],
                current_block + EXPECTED_WAIT_TIME_BLOCKS - 1,
            )
            .await
            .unwrap(),
        TxCheckOutcome::Stuck
    );
}

/// Test for a normal `ETHSender` workflow:
/// - we send the two sequential operations (commit and verify);
/// - they are successfully committed to the Ethereum;
/// - `completeWithdrawals` tx is sent to the Ethereum;
/// - notification is sent after `verify` operation is committed.
#[tokio::test]
async fn operation_commitment_workflow() {
    let mut eth_sender = default_eth_sender().await;

    // In this test we will run one commit and one verify operation and should
    // obtain a notification about the operation being completed in the end.
    let operations = vec![
        test_data::commit_operation(0),
        test_data::verify_operation(0),
    ];

    for (eth_op_id, operation) in operations.iter().enumerate() {
        let nonce = eth_op_id as i64;

        // Send an operation to `ETHSender`.
        eth_sender
            .db
            .send_operation(operation.clone())
            .await
            .unwrap();

        // Retrieve it there and then process.
        eth_sender.load_new_operations().await;

        eth_sender.proceed_next_operations().await;

        // Now we should see that transaction is stored in the database and sent to the Ethereum.
        let deadline_block = eth_sender.get_deadline_block(eth_sender.ethereum.block_number);
        let mut expected_tx = create_signed_tx(
            eth_op_id as i64,
            &eth_sender,
            operation,
            deadline_block,
            nonce,
        )
        .await;
        expected_tx.id = eth_op_id as i64; // We have to set the ID manually.

        eth_sender.db.assert_stored(&expected_tx).await;

        eth_sender
            .ethereum
            .assert_sent(&expected_tx.used_tx_hashes[0])
            .await;

        // Increment block, make the transaction look successfully executed, and process the
        // operation again.
        eth_sender
            .ethereum
            .add_successfull_execution(expected_tx.used_tx_hashes[0], WAIT_CONFIRMATIONS)
            .await;

        eth_sender.proceed_next_operations().await;

        // Check that operation is confirmed.
        expected_tx.confirmed = true;
        expected_tx.final_hash = Some(expected_tx.used_tx_hashes[0]);
        eth_sender.db.assert_confirmed(&expected_tx).await;
    }
    // Process the next operation and check that `completeWithdrawals` transaction is stored and sent.
    eth_sender.proceed_next_operations().await;

    let eth_op_idx = operations.len() as i64;
    let nonce = eth_op_idx;
    let deadline_block = eth_sender.get_deadline_block(eth_sender.ethereum.block_number);
    let mut withdraw_op_tx =
        create_signed_withdraw_tx(eth_op_idx, &eth_sender, deadline_block, nonce).await;

    eth_sender.db.assert_stored(&withdraw_op_tx).await;
    eth_sender
        .ethereum
        .assert_sent(&withdraw_op_tx.used_tx_hashes[0])
        .await;

    // Mark `completeWithdrawals` as completed.
    eth_sender
        .ethereum
        .add_successfull_execution(withdraw_op_tx.used_tx_hashes[0], WAIT_CONFIRMATIONS)
        .await;
    eth_sender.proceed_next_operations().await;

    // Check that `completeWithdrawals` is completed in the DB.
    withdraw_op_tx.confirmed = true;
    withdraw_op_tx.final_hash = Some(withdraw_op_tx.used_tx_hashes[0]);
    eth_sender.db.assert_confirmed(&withdraw_op_tx).await;
}

/// A simple scenario for a stuck transaction:
/// - A transaction is sent to the Ethereum.
/// - It is not processed after some blocks.
/// - `ETHSender` creates a new transaction with increased gas.
/// - This transaction is completed successfully.
#[tokio::test]
async fn stuck_transaction() {
    let mut eth_sender = default_eth_sender().await;

    // Workflow for the test is similar to `operation_commitment_workflow`.
    let operation = test_data::commit_operation(0);
    // Send an operation to `ETHSender`.
    eth_sender
        .db
        .send_operation(operation.clone())
        .await
        .unwrap();

    eth_sender.load_new_operations().await;
    eth_sender.proceed_next_operations().await;

    let eth_op_id = 0;
    let nonce = 0;
    let deadline_block = eth_sender.get_deadline_block(eth_sender.ethereum.block_number);
    let mut stuck_tx =
        create_signed_tx(eth_op_id, &eth_sender, &operation, deadline_block, nonce).await;

    // Skip some blocks and expect sender to send a new tx.
    eth_sender.ethereum.block_number += EXPECTED_WAIT_TIME_BLOCKS;
    eth_sender.proceed_next_operations().await;

    // Check that new transaction is sent (and created based on the previous stuck tx).
    let expected_sent_tx = eth_sender
        .create_supplement_tx(
            eth_sender.get_deadline_block(eth_sender.ethereum.block_number),
            &mut stuck_tx,
        )
        .await
        .unwrap();
    eth_sender.db.assert_stored(&stuck_tx).await;
    eth_sender
        .ethereum
        .assert_sent(&expected_sent_tx.hash)
        .await;

    // Increment block, make the transaction look successfully executed, and process the
    // operation again.
    eth_sender
        .ethereum
        .add_successfull_execution(stuck_tx.used_tx_hashes[1], WAIT_CONFIRMATIONS)
        .await;
    eth_sender.proceed_next_operations().await;

    // Check that operation is confirmed (we set the final hash to the second sent tx).
    stuck_tx.confirmed = true;
    stuck_tx.final_hash = Some(stuck_tx.used_tx_hashes[1]);
    eth_sender.db.assert_confirmed(&stuck_tx).await;
}

/// This test verifies that with multiple operations received all-together,
/// their order is respected and no processing of the next operation is started until
/// the previous one is committed.
///
/// This test includes all three operation types (commit, verify and withdraw).
#[tokio::test]
async fn operations_order() {
    let mut eth_sender = default_eth_sender().await;

    // We send multiple the operations at once to the channel.
    let operations_count = 3;
    let mut operations = Vec::new();
    let commit_operations = &test_data::COMMIT_OPERATIONS[..operations_count];
    let verify_operations = &test_data::VERIFY_OPERATIONS[..operations_count];
    operations.extend_from_slice(commit_operations);
    operations.extend_from_slice(verify_operations);

    // Also we create the list of expected transactions.
    let mut expected_txs = Vec::new();

    // Create expected txs from all the operations.
    // Since we create 3 operations at each cycle iteration,
    // the logic of ID calculating is (i * 3), (i * 3 + 1), (i * 3 + 2).
    // On the first iteration the indices 0, 1 and 2 will be taken, then it
    // will be 3, 4 and 5, etc.
    for (idx, (commit_operation, verify_operation)) in
        commit_operations.iter().zip(verify_operations).enumerate()
    {
        // Create the commit operation.
        let start_block = 1 + WAIT_CONFIRMATIONS * (idx * 3) as u64;
        let deadline_block = eth_sender.get_deadline_block(start_block);
        let eth_op_idx = (idx * 3) as i64;
        let nonce = eth_op_idx;

        let commit_op_tx = create_signed_tx(
            eth_op_idx,
            &eth_sender,
            commit_operation,
            deadline_block,
            nonce,
        )
        .await;

        expected_txs.push(commit_op_tx);

        // Create the verify operation, as by priority it will be processed right after `commit`.
        let start_block = 1 + WAIT_CONFIRMATIONS * (idx * 3 + 1) as u64;
        let deadline_block = eth_sender.get_deadline_block(start_block);
        let eth_op_idx = (idx * 3 + 1) as i64;
        let nonce = eth_op_idx;

        let verify_op_tx = create_signed_tx(
            eth_op_idx,
            &eth_sender,
            verify_operation,
            deadline_block,
            nonce,
        )
        .await;

        expected_txs.push(verify_op_tx);

        // Create the withdraw operation.
        let start_block = 1 + WAIT_CONFIRMATIONS * (idx * 3 + 2) as u64;
        let deadline_block = eth_sender.get_deadline_block(start_block);
        let eth_op_idx = (idx * 3 + 2) as i64;
        let nonce = eth_op_idx;

        let withdraw_op_tx =
            create_signed_withdraw_tx(eth_op_idx, &eth_sender, deadline_block, nonce).await;

        expected_txs.push(withdraw_op_tx);
    }

    for operation in operations.iter() {
        eth_sender
            .db
            .send_operation(operation.clone())
            .await
            .unwrap();
    }
    eth_sender.load_new_operations().await;

    // Then we go through the operations and check that the order of operations is preserved.
    for mut tx in expected_txs.into_iter() {
        let current_tx_hash = tx.used_tx_hashes[0];

        eth_sender.proceed_next_operations().await;

        // Check that current expected tx is stored.
        eth_sender.db.assert_stored(&tx).await;
        eth_sender.ethereum.assert_sent(&current_tx_hash).await;

        // Mark the tx as successfully
        eth_sender
            .ethereum
            .add_successfull_execution(current_tx_hash, WAIT_CONFIRMATIONS)
            .await;
        eth_sender.proceed_next_operations().await;

        // Update the fields in the tx and check if it's confirmed.
        tx.confirmed = true;
        tx.final_hash = Some(current_tx_hash);
        eth_sender.db.assert_confirmed(&tx).await;
    }
}

/// Check that upon a transaction failure the incident causes a panic by default.
#[tokio::test]
#[should_panic(expected = "Cannot operate after unexpected TX failure")]
async fn transaction_failure() {
    let mut eth_sender = default_eth_sender().await;

    // Workflow for the test is similar to `operation_commitment_workflow`.
    let operation = test_data::commit_operation(0);
    eth_sender
        .db
        .send_operation(operation.clone())
        .await
        .unwrap();

    let eth_op_id = 0;
    let nonce = 0;
    let deadline_block = eth_sender.get_deadline_block(eth_sender.ethereum.block_number);
    let failing_tx =
        create_signed_tx(eth_op_id, &eth_sender, &operation, deadline_block, nonce).await;

    eth_sender.load_new_operations().await;
    eth_sender.proceed_next_operations().await;

    eth_sender
        .ethereum
        .add_failed_execution(&failing_tx.used_tx_hashes[0], WAIT_CONFIRMATIONS)
        .await;
    eth_sender.proceed_next_operations().await;
}

/// Check that after recovering state with several non-processed operations
/// they will be processed normally.
#[tokio::test]
async fn restore_state() {
    let (operations, stored_operations) = {
        // This `eth_sender` is required to generate the input only.
        let eth_sender = default_eth_sender().await;

        let commit_op = test_data::commit_operation(0);
        let verify_op = test_data::verify_operation(0);

        let deadline_block = eth_sender.get_deadline_block(1);
        let commit_op_tx = create_signed_tx(0, &eth_sender, &commit_op, deadline_block, 0).await;

        let deadline_block = eth_sender.get_deadline_block(1 + WAIT_CONFIRMATIONS);
        let verify_op_tx = create_signed_tx(1, &eth_sender, &verify_op, deadline_block, 1).await;

        let operations = vec![commit_op, verify_op];
        let stored_operations = vec![commit_op_tx, verify_op_tx];

        (operations, stored_operations)
    };

    let stats = ETHStats {
        commit_ops: 1,
        verify_ops: 1,
        withdraw_ops: 0,
    };
    let mut eth_sender = restored_eth_sender(stored_operations, stats).await;

    for (eth_op_id, operation) in operations.iter().enumerate() {
        // Note that we DO NOT send an operation to `ETHSender` and neither receive it.

        // We do process operations restored from the DB though.
        // The rest of this test is the same as in `operation_commitment_workflow`.
        eth_sender.proceed_next_operations().await;

        let deadline_block = eth_sender.get_deadline_block(eth_sender.ethereum.block_number);
        let nonce = eth_op_id as i64;
        let mut expected_tx = create_signed_tx(
            eth_op_id as i64,
            &eth_sender,
            operation,
            deadline_block,
            nonce,
        )
        .await;
        expected_tx.id = eth_op_id as i64;

        eth_sender.db.assert_stored(&expected_tx).await;

        eth_sender
            .ethereum
            .add_successfull_execution(expected_tx.used_tx_hashes[0], WAIT_CONFIRMATIONS)
            .await;
        eth_sender.proceed_next_operations().await;

        expected_tx.confirmed = true;
        expected_tx.final_hash = Some(expected_tx.used_tx_hashes[0]);
        eth_sender.db.assert_confirmed(&expected_tx).await;
    }
}

/// Checks that even after getting the first transaction stuck and sending the next
/// one, confirmation for the first (stuck) transaction is processed and leads
/// to the operation commitment.
#[tokio::test]
async fn confirmations_independence() {
    // Workflow in the test is the same as in `stuck_transaction`, except for the fact
    // that confirmation is obtained for the stuck transaction instead of the latter one.

    let mut eth_sender = default_eth_sender().await;

    let operation = test_data::commit_operation(0);
    eth_sender
        .db
        .send_operation(operation.clone())
        .await
        .unwrap();

    eth_sender.load_new_operations().await;
    eth_sender.proceed_next_operations().await;

    let eth_op_id = 0;
    let nonce = 0;
    let deadline_block = eth_sender.get_deadline_block(eth_sender.ethereum.block_number);
    let mut stuck_tx =
        create_signed_tx(eth_op_id, &eth_sender, &operation, deadline_block, nonce).await;

    eth_sender.ethereum.block_number += EXPECTED_WAIT_TIME_BLOCKS;
    eth_sender.proceed_next_operations().await;

    let next_tx = eth_sender
        .create_supplement_tx(
            eth_sender.get_deadline_block(eth_sender.ethereum.block_number),
            &mut stuck_tx,
        )
        .await
        .unwrap();
    eth_sender.db.assert_stored(&stuck_tx).await;
    eth_sender.ethereum.assert_sent(&next_tx.hash).await;

    // Add a confirmation for a *stuck* transaction.
    eth_sender
        .ethereum
        .add_successfull_execution(stuck_tx.used_tx_hashes[0], WAIT_CONFIRMATIONS)
        .await;
    eth_sender.proceed_next_operations().await;

    // Check that operation is confirmed (we set the final hash to the *first* sent tx).
    stuck_tx.confirmed = true;
    stuck_tx.final_hash = Some(stuck_tx.used_tx_hashes[0]);
    eth_sender.db.assert_confirmed(&stuck_tx).await;
}

/// This test is the same as `operations_order`, but configures ETH sender
/// to use 3 transactions in flight, and checks that they are being sent concurrently.
#[tokio::test]
async fn concurrent_operations_order() {
    const MAX_TXS_IN_FLIGHT: u64 = 3;
    let mut eth_sender = concurrent_eth_sender(MAX_TXS_IN_FLIGHT).await;

    // We send multiple the operations at once to the channel.
    let operations_count = 3;
    let commit_operations = &test_data::COMMIT_OPERATIONS[..operations_count];
    let verify_operations = &test_data::VERIFY_OPERATIONS[..operations_count];

    // Also we create the list of expected transactions.
    let mut expected_txs = Vec::new();

    // Create expected txs from all the operations.
    // Since we create 3 operations at each cycle iteration,
    // the logic of ID calculating is (i * 3), (i * 3 + 1), (i * 3 + 2).
    // On the first iteration the indices 0, 1 and 2 will be taken, then it
    // will be 3, 4 and 5, etc.

    for (idx, (commit_operation, verify_operation)) in
        commit_operations.iter().zip(verify_operations).enumerate()
    {
        // Commit/verify transactions from one iteration will be sent concurrently,
        // thus the deadline block is the same for them.
        // However, withdraw operation will be sent after these txs are confirmed,
        // so it will have a different deadline block,
        let start_block = 1 + WAIT_CONFIRMATIONS * (idx * 3) as u64;
        let deadline_block = eth_sender.get_deadline_block(start_block);

        // Create the commit operation.
        let eth_op_idx = (idx * 3) as i64;
        let nonce = eth_op_idx;

        let commit_op_tx = create_signed_tx(
            eth_op_idx,
            &eth_sender,
            commit_operation,
            deadline_block,
            nonce,
        )
        .await;

        expected_txs.push(commit_op_tx);

        // Create the verify operation, as by priority it will be processed right after `commit`.
        let eth_op_idx = (idx * 3 + 1) as i64;
        let nonce = eth_op_idx;

        let verify_op_tx = create_signed_tx(
            eth_op_idx,
            &eth_sender,
            verify_operation,
            deadline_block,
            nonce,
        )
        .await;

        expected_txs.push(verify_op_tx);

        // Create the withdraw operation.
        let start_block = 1 + WAIT_CONFIRMATIONS * (idx * 3 + 2) as u64;
        let deadline_block = eth_sender.get_deadline_block(start_block);
        let eth_op_idx = (idx * 3 + 2) as i64;
        let nonce = eth_op_idx;

        let withdraw_op_tx =
            create_signed_withdraw_tx(eth_op_idx, &eth_sender, deadline_block, nonce).await;

        expected_txs.push(withdraw_op_tx);
    }
    // Pair commit/verify operations.
    let mut operations_iter = commit_operations.iter().zip(verify_operations);

    // Then we go through the operations and check that the order of operations is preserved.
    // Here we take N txs at each interaction.
    for txs in expected_txs.chunks(MAX_TXS_IN_FLIGHT as usize) {
        // We send operations by two, so the order will be "commit-verify-withdraw".
        // If we'll send all the operations together, the order will be "commit-verify-commit-verify-withdraw",
        // since withdraw is only sent after verify operation is confirmed.
        let (commit_op, verify_op) = operations_iter.next().unwrap();

        eth_sender
            .db
            .send_operation(commit_op.clone())
            .await
            .unwrap();
        eth_sender
            .db
            .send_operation(verify_op.clone())
            .await
            .unwrap();

        eth_sender.load_new_operations().await;

        // Call `proceed_next_operations`. Several txs should be sent.
        eth_sender.proceed_next_operations().await;

        let commit_tx = &txs[0];
        let verify_tx = &txs[1];
        let mut withdraw_tx = txs[2].clone();

        // Check that commit/verify txs are sent and add the successful execution for them.
        for tx in &[commit_tx, verify_tx] {
            let current_tx_hash = tx.used_tx_hashes[0];

            // Check that current expected tx is stored.
            eth_sender.db.assert_stored(&tx).await;
            eth_sender.ethereum.assert_sent(&current_tx_hash).await;

            // Mark the tx as successfully
            eth_sender
                .ethereum
                .add_successfull_execution(current_tx_hash, WAIT_CONFIRMATIONS)
                .await;
        }

        // Call `proceed_next_operations` again. Both txs should become confirmed.
        eth_sender.proceed_next_operations().await;

        for &tx in &[commit_tx, verify_tx] {
            let mut tx = tx.clone();
            let current_tx_hash = tx.used_tx_hashes[0];

            // Update the fields in the tx and check if it's confirmed.
            tx.confirmed = true;
            tx.final_hash = Some(current_tx_hash);
            eth_sender.db.assert_confirmed(&tx).await;
        }

        // Now, the withdraw operation should be taken from the queue, and
        // sent to the Ethereum.
        eth_sender.proceed_next_operations().await;

        let withdraw_tx_hash = withdraw_tx.used_tx_hashes[0];
        eth_sender.db.assert_stored(&withdraw_tx).await;
        eth_sender.ethereum.assert_sent(&withdraw_tx_hash).await;

        // Mark the tx as successfully
        eth_sender
            .ethereum
            .add_successfull_execution(withdraw_tx_hash, WAIT_CONFIRMATIONS)
            .await;

        // Call `proceed_next_operations` again. Withdraw tx should become confirmed.
        eth_sender.proceed_next_operations().await;
        // Update the fields in the tx and check if it's confirmed.
        withdraw_tx.confirmed = true;
        withdraw_tx.final_hash = Some(withdraw_tx_hash);
        eth_sender.db.assert_confirmed(&withdraw_tx).await;
    }
}
