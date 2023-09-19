///////////////////////////////////////////////////////////
//
// escrow_self_cancel_qr.js - return escrowed XRP to the sender with online transaction submit
// syntax: node escrow_cancel_qr [PUB|TEST|DEV] ACCOUNT SEED_KEY ESCROW_TX_SEQUENCE_ON_CREATE SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
///////////////////////////////////////////////////////////

'use strict';

const { fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee } = require('../../common/libs/common.js');
const { escrowSelfCancel } = require('../escrow_cancel.js');
const { AddTransactionSequences, Wallet } = require('../../common/sign.js');
const { SignQR } = require('../../common/sign_qr.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	sign_key: { id: 3, default: '', required: true, desc: 'account secret seed / mnemonic phrase to sign the transaction', scramble: true },
	escrow_tx_sequence: { id: 4, default: '', required: true, desc: 'Sequence of the EscrowCreate transaction to be canceled', type: 'number' },

	source_account_sequence: { id: 5, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 6, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 7, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const txSequence = (isNaN(main_params.escrow_tx_sequence.value) ? null : main_params.escrow_tx_sequence.value);

	const tx = escrowSelfCancel({
		account: main_params.account.value,
		feeDrops: networkMinFee(main_params.network.value), // transaction fee in 'drops'
		txSequence
	});

	await AddTransactionSequences(
		tx,
		{
			accSequence: main_params.source_account_sequence.value,
			ledgerSeqIndex: main_params.ledger_current_index.value,
			ledgerTimeout: main_params.ledger_index_timeout.value
		}
	);

	showTransactionDetails(tx);
	return tx;
}

async function signWithQR() {
	const transaction = await buildTransaction();

	await SignQR({ wallet: Wallet(main_params.sign_key.value), transaction });
}

function showTransactionDetails (tx) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
