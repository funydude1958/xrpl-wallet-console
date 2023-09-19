///////////////////////////////////////////////////////////
//
// escrow_cancel.js - return escrowed XRP to the sender
// syntax: node escrow_cancel [PUB|TEST|DEV] ACCOUNT ESCROW_TX_SEQUENCE_ON_CREATE
//
// Any account may submit an EscrowCancel transaction.
// If the corresponding EscrowCreate transaction did not specify a CancelAfter time, the EscrowCancel transaction fails.
//
// Docs: https://xrpl.org/escrowcancel.html
//       https://xrpl.org/cancel-an-expired-escrow.html
//       https://js.xrpl.org/interfaces/EscrowCancel.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'escrow_cancel';

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ShowTransactionDetails, OutputJsonTransaction } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	escrow_tx_sequence: { id: 3, default: '', required: true, desc: "Sequence of the EscrowCreate transaction to be canceled", type: 'number' },
}

function escrowCancel({ accountSrc, accountInitiator, txSequence, feeDrops }) {
	let error;

	if (!accountSrc){ console.error("Must specify 'accountSrc' in call escrowCancel()"); error = true; }
	if (!accountInitiator){ console.error("Must specify 'accountInitiator' in call escrowCancel()"); error = true; }
	if (!txSequence){ console.error("Must specify 'txSequence' in call escrowCancel()"); error = true; }
	if (!feeDrops || feeDrops <= 0){ console.error("Must specify 'feeDrops' greater than zero in call escrowCancel()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'EscrowCancel',
		Owner: accountSrc, // Address of the source account that funded the escrow payment.
		Account: accountInitiator, // The unique address of the account that initiated the transaction.
		OfferSequence: Number(txSequence), // Transaction sequence (or Ticket number) of EscrowCreate transaction that created the escrow to cancel.
		Fee: feeDrops.toString()
	};

	return cmd;
}

const escrowSelfCancel = function ({ account, txSequence, feeDrops }){
	return escrowCancel({
		accountSrc: account,
		accountInitiator: account,
		txSequence,
		feeDrops
	});
}

async function commandTxParams() {
	let txData = escrowSelfCancel({
		account: main_params.account.value,
		txSequence: main_params.escrow_tx_sequence.value,
		feeDrops: networkMinFee(main_params.network.value)
	});

	await AddTransactionSequences(
		txData,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	return txData;
}

async function main(){
	await defineMainParams(main_params);

	const txParams = await commandTxParams();

	ShowTransactionDetails(txParams);

	quit( OutputJsonTransaction(txParams) );
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.escrowCancel = escrowCancel;
	exports.escrowSelfCancel = escrowSelfCancel;
}
