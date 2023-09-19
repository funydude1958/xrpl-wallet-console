///////////////////////////////////////////////////////////
//
// escrow_self_finish_qr.js - transfer escrowed XRP to the receiver with online transaction submit
// syntax: node escrow_finish_qr [PUB|TEST|DEV] ACCOUNT SEED_KEY ESCROW_TX_SEQUENCE_ON_CREATE CONDITION SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
///////////////////////////////////////////////////////////

'use strict';

const { fail, prompt, defineMainParams, ledgerIndexMinTimeout, ConfirmFeeValue } = require('../../common/libs/common.js');
const { escrowSelfFinish, Fee } = require('../escrow_finish.js');
const { escrowFinishFulfillmentRequest } = require('../escrow_condition.js');
const { AddTransactionSequences, Wallet } = require('../../common/sign.js');
const { SignQR } = require('../../common/sign_qr.js');

const main_params = {
	network: { id: 1, default: '', required: true },
	account: { id: 2, default: '', required: true },
	sign_key: { id: 3, default: '', required: true, desc: 'account secret seed / mnemonic phrase to sign the transaction', scramble: true },
	tx_sequence: { id: 4, default: '', required: true, desc: 'Sequence of the escrow transaction to be finished', type: 'number' },
	escrow_condition: { id: 5, default: '', required: false, desc: 'Escrow Condition if exists' },

	source_account_sequence: { id: 6, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 7, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 8, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const txSequence = (isNaN(main_params.tx_sequence.value) ? null : main_params.tx_sequence.value);
	const finishParams = {
		account: main_params.account.value,
		feeDrops: Fee(main_params.network.value),
		txSequence
	};

	if (main_params.escrow_condition.value) { finishParams.condition = main_params.escrow_condition.value; }

	const fulfil = await escrowFinishFulfillmentRequest({ escrowSrcAccountAddress: main_params.account.value, escrowTestCondition: main_params.escrow_condition.value });
	if (fulfil?.data) {
		finishParams.conditionFulfillment = fulfil.data;
		finishParams.feeDrops = Fee(main_params.network.value, { withCondition: true, preimageSize: fulfil.preimageSize });
	}
	finishParams.feeDrops = await ConfirmFeeValue(finishParams.feeDrops);

	const tx = escrowSelfFinish(finishParams);

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
