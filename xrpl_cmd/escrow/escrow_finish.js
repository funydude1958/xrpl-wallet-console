///////////////////////////////////////////////////////////
//
// escrow_finish.js - transfer escrowed XRP to the receiver
// syntax: node escrow_finish [PUB|TEST|DEV] ACCOUNT ESCROW_TX_SEQUENCE_ON_CREATE
//
// Any account may submit an EscrowFinish transaction.
//
// If the held payment has a Condition, you cannot execute it unless you provide a matching Fulfillment for the condition.
//
// The minimum transaction cost to submit an EscrowFinish transaction increases if it contains a fulfillment.
// If the transaction has no fulfillment, the transaction cost is the standard 10 drops.
// If the transaction contains a fulfillment, the transaction cost is 330 drops of XRP plus another 10 drops for every 16 bytes in size of the preimage.
//
// Docs: https://xrpl.org/escrowfinish.html
//       https://js.xrpl.org/interfaces/EscrowFinish.html
//       https://xrpl.org/transaction-cost.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'escrow_finish';

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee, showLoadedModules, ShowWarning, ShowTransactionDetails, OutputJsonTransaction, ConfirmFeeValue } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');
const { escrowFinishFulfillmentRequest } = require('./escrow_condition.js');

const main_params = {
	network: { id: 1, default: '', required: true },
	account: { id: 2, default: '', required: true },
	escrow_tx_sequence: { id: 3, default: '', required: true, desc: 'Sequence of the EscrowCreate transaction', type: 'number' },
	escrow_condition: { id: 4, default: '', required: false, desc: 'Escrow Condition if exists' },
}

function Fee(network, { withCondition, preimageSize } = {}) { // transaction fee in 'drops'
	// If the transaction contains a fulfillment, the transaction cost
	// is 330 drops of XRP plus another 10 drops for every 16 bytes in size of the preimage.

	const minFee = networkMinFee(network);
	const baseCost = 330;
	const preimageBlockCost = 10;

	if (!withCondition) { return minFee; }
	if (!preimageSize) { return baseCost + preimageBlockCost; }

	const sizeCost = Math.ceil(preimageSize / 16.0) * preimageBlockCost;

	return (baseCost + sizeCost);
}

function escrowFinish({ accountSrc, accountInitiator, txSequence, feeDrops, conditionFulfillment, condition }) {
	let error;

	if (!accountSrc){ console.error("Must specify 'accountSrc' in call escrowFinish()"); error = true; }
	if (!accountInitiator){ console.error("Must specify 'accountInitiator' in call escrowFinish()"); error = true; }
	if (!txSequence){ console.error("Must specify 'txSequence' in call escrowFinish()"); error = true; }
	if (!feeDrops || feeDrops <= 0){ console.error("Must specify 'feeDrops' greater than zero in call escrowFinish()"); error = true; }
	if (typeof conditionFulfillment !== 'undefined' && !conditionFulfillment.length){ console.error("Must not specify empty 'conditionFulfillment' in call escrowFinish()"); error = true; }
	if (typeof condition !== 'undefined' && !condition.length){ console.error("Must not specify empty 'condition' in call escrowFinish()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'EscrowFinish',
		Account: accountInitiator, // The unique address of the account that initiated the transaction.
		Owner: accountSrc, // Address of the source account that funded the escrow payment.
		OfferSequence: Number(txSequence), // Transaction sequence (or Ticket number) of EscrowCreate transaction that created the escrow to cancel.
		Fee: feeDrops.toString()
	};

	if (conditionFulfillment) { cmd.Fulfillment = conditionFulfillment.toUpperCase(); }
	if (condition) { cmd.Condition = condition.toUpperCase(); }

	if (cmd.Fulfillment && !cmd.Condition) { ShowWarning('Transaction MUST contain both Fulfillment and Condition!\nIt will be rejected as malformed otherwise.'); }

	return cmd;
}

const escrowSelfFinish = function ({ account, txSequence, feeDrops, conditionFulfillment, condition }){
	return escrowFinish({
		accountSrc: account,
		accountInitiator: account,
		txSequence, feeDrops, conditionFulfillment, condition
	});
}

async function buildTransaction() {
	const finishParams = {
		account: main_params.account.value,
		txSequence: main_params.escrow_tx_sequence.value,
		feeDrops: Fee(main_params.network.value)
	};
	if (main_params.escrow_condition.value) { finishParams.condition = main_params.escrow_condition.value; }

	const fulfil = await escrowFinishFulfillmentRequest({ escrowSrcAccountAddress: main_params.account.value, escrowTestCondition: main_params.escrow_condition.value });
	if (fulfil?.data) {
		finishParams.conditionFulfillment = fulfil.data;
		finishParams.feeDrops = Fee(main_params.network.value, { withCondition: true, preimageSize: fulfil.preimageSize });
	}
	finishParams.feeDrops = await ConfirmFeeValue(finishParams.feeDrops);

	let txData = escrowSelfFinish(finishParams);

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

	const txParams = await buildTransaction();

	ShowTransactionDetails(txParams);

	quit( OutputJsonTransaction(txParams) );
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.escrowSelfFinish = escrowSelfFinish;
	exports.escrowFinish = escrowFinish;
	exports.Fee = Fee;
}
