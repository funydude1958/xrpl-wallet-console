///////////////////////////////////////////////////////////
//
// escrow_cancel_submit.js - return escrowed XRP to the sender with online transaction submit
// syntax: node escrow_cancel_submit [PUB|TEST|DEV] ACCOUNT SEED_KEY ESCROW_TX_SEQUENCE_ON_CREATE ESCROW_TX_HASH
//
///////////////////////////////////////////////////////////

'use strict';

const { dropsToXrp, rippleTimeToISOTime, unixTimeToRippleTime } = require('xrpl');

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, XrplClient } = require('../../common/libs/common.js');
const { FindAccountEscrow } = require('../../account_info/account_escrows.js');
const { escrowSelfCancel } = require('../escrow_cancel.js');
const { Submit } = require('../../common/submit_send.js');
const { AddTransactionSequences, SignWithKeyPrompt } = require('../../common/sign.js');

const main_params = {
	network: { id: 1, default: '', required: true },
	account: { id: 2, default: '', required: true },
	key: { id: 3, default: '', required: true, desc: 'seed/passphrase', scramble: true },
	escrow_tx_sequence: { id: 4, default: '', required: false }, // escrow_tx_sequence or tx_hash must be specified!
	escrow_tx_hash: { id: 5, default: '', required: false },
}

function showTransactionDetails (tx, escrow) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Fee: ${tx.Fee} drops`);

	if (escrow) {
		const currentRippleTimestamp = unixTimeToRippleTime(new Date().getTime());
		const available = (escrow.CancelAfter && currentRippleTimestamp > escrow.CancelAfter);

		console.log(`Cancel Escrow Amount: ${dropsToXrp(escrow.Amount)} XRP ${escrow.self ? 'on self' : `destined for another account '${escrow.Destination}'`}`);
		console.log(`  Escrow Date: ${rippleTimeToISOTime(escrow.date)}`);
		if (escrow.FinishAfter) { console.log(`  Escrow Finish available After: ${rippleTimeToISOTime(escrow.FinishAfter)}`); }
		if (escrow.CancelAfter) { console.log(`  Escrow Cancel available After: ${rippleTimeToISOTime(escrow.CancelAfter)} ${available ? '' : '< ATTENTION >'}`); }

		if (!available) {
			console.log(`\n-= ATTENTION! ESCROW CANCELLATION IS NOT YET AVAILABLE! (${escrow.CancelAfter ? 'see Cancel available After date' : "'Cancel After' date was not specified for the escrow"}) =-`);

			if (escrow.FinishAfter && currentRippleTimestamp > escrow.FinishAfter) {
				console.log('\nEscrow Finish is already available.');
			}
		}
	} else {
		console.log('Unable to find information of the escrow to be canceled');
	}
	console.log('=========');
}

async function buildTransaction() {
	const txSeqIsNumber = !isNaN(main_params.escrow_tx_sequence.value);
	const txHash = (main_params.escrow_tx_hash.value ? main_params.escrow_tx_hash.value : (main_params.escrow_tx_sequence.value && !txSeqIsNumber ? main_params.escrow_tx_sequence.value : null));
	let txSequence = (txSeqIsNumber ? main_params.escrow_tx_sequence.value : null);

	const client = await XrplClient({ network: main_params.network.value });
	const escrow = await FindAccountEscrow({ client, account: main_params.account.value, txHash, txSequence });
	if (escrow && !txSequence) { txSequence = escrow.Sequence };

	console.log(`\nEscrow with specified Sequence/Hash ${escrow ? 'EXISTS' : 'NOT FOUND' }`);

	const tx = escrowSelfCancel({
		account: main_params.account.value,
		feeDrops: networkMinFee(main_params.network.value), // transaction fee in 'drops'
		txSequence
	});

	await AddTransactionSequences(
		tx,
		{
			account: main_params.account.value,
			client,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	showTransactionDetails(tx, escrow);

	const signedTransaction = await SignWithKeyPrompt({
		transaction: tx,
		secretKey: main_params.key.value,
		secretKeyPromptOpts: main_params.key,
		promptParamName: 'key',
		promptAccountAddress: main_params.account.value
	});

	console.log('\nSIGNED TRANSACTION:');
	console.log(signedTransaction);

	if (client) { client.disconnect(); }
	return signedTransaction;
}

async function signAndSubmit() {
	const transaction = await buildTransaction();

	await Submit(transaction.tx_blob, { network: main_params.network.value });
}

async function main(){
	await defineMainParams(main_params);

	await signAndSubmit();
}

main();
