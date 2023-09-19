///////////////////////////////////////////////////////////
//
// escrow_self_finish_submit.js - transfer escrowed XRP to the receiver with online transaction submit
// syntax: node escrow_finish_submit [PUB|TEST|DEV] ACCOUNT SEED_KEY ESCROW_TX_SEQUENCE_ON_CREATE ESCROW_TX_HASH
//
///////////////////////////////////////////////////////////

'use strict';

const { dropsToXrp, rippleTimeToISOTime, unixTimeToRippleTime } = require('xrpl');

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, XrplClient, ConfirmFeeValue } = require('../../common/libs/common.js');
const { Submit } = require('../../common/submit_send.js');
const { AddTransactionSequences, SignWithKeyPrompt } = require('../../common/sign.js');
const { PromptParameter } = require('../../common/libs/cli_args.js');
const { FindAccountEscrow } = require('../../account_info/account_escrows.js');
const { escrowSelfFinish, Fee } = require('../escrow_finish.js');
const { escrowFinishFulfillmentRequest } = require('../escrow_condition.js');

const main_params = {
	network: { id: 1, default: '', required: true },
	escrow_account: { id: 2, default: '', required: true },
	sign_key: { id: 3, default: '', required: true, desc: 'account secret seed / mnemonic phrase to sign the transaction', scramble: true },
	escrow_tx_sequence: { id: 4, default: '', required: true, desc: 'Sequence or Hash of the EscrowCreate transaction' }, // escrow_tx_sequence or tx_hash must be specified!
	escrow_tx_hash: { id: 5, default: '', required: false },
}

async function fetchEscrowInfo (account, txHash, txSequence) {
	let withCondition;
	console.log(`\nSearching the escrow ...`);

	const client = await XrplClient({ network: main_params.network.value });
	const escrow = await FindAccountEscrow({ client, account, txHash, txSequence });

	console.log(`\nEscrow with specified Sequence/Hash ${escrow ? 'EXISTS' : 'NOT FOUND' }`);
	if (escrow && !txSequence) { txSequence = escrow.Sequence; }

	if (escrow) { withCondition = escrow?.Condition; }
	else {
		const answer = (await PromptParameter({ message: 'Is this escrow protected by a Condition field ? (Yes/No)', newline: true, required: true, infinityLoop: 20 })).toLowerCase();
		withCondition = ['y', 'yes'].includes(answer);
	}

	return { withCondition, txSequence, escrow, client };
}

function showTransactionDetails (tx, escrow) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Fee: ${tx.Fee} drops`);

	if (escrow) {
		const currentRippleTimestamp = unixTimeToRippleTime(new Date().getTime());
		const availableFinish = (!escrow.FinishAfter || currentRippleTimestamp > escrow.FinishAfter);
		const availableCancel = (escrow.CancelAfter && currentRippleTimestamp > escrow.CancelAfter);
		const expiredFinish = availableCancel && availableFinish;

		// should be canceled

		console.log(`Finish Escrow and transfer the Amount: ${dropsToXrp(escrow.Amount)} XRP ${escrow.self ? 'back to self' : `to another account '${escrow.Destination}'`}`)
		console.log(`  Escrow Date: ${rippleTimeToISOTime(escrow.date)}`)
		if (escrow.FinishAfter) { console.log(`  Escrow Finish available After: ${rippleTimeToISOTime(escrow.FinishAfter)} ${availableFinish && !expiredFinish ? '' : '< ATTENTION >'}`); }
		if (escrow.CancelAfter) { console.log(`  Escrow Cancel available After: ${rippleTimeToISOTime(escrow.CancelAfter)}`); }

		if (!availableFinish) {
			console.log(`\n-= ATTENTION! ESCROW FINISH IS NOT YET AVAILABLE! (${escrow.FinishAfter ? 'see Finish available After date' : "'Finish After' date was not specified for the escrow"}) =-`);

			if (escrow.CancelAfter && currentRippleTimestamp > escrow.CancelAfter) {
				console.log('\nEscrow cancellation is already available.');
			}
		}
		if (expiredFinish) {
			console.log(`\n-= ATTENTION! ESCROW FINISH EXPIRED!  ESCROW IS READY TO BE CANCELED! =-`);
		}
	} else {
		console.log('Unable to find information of the escrow to be finished');
	}
	console.log('=========');
}

async function buildTransaction() {
	const txSeqIsNumber = !isNaN(main_params.escrow_tx_sequence.value);
	const txHash = (main_params.escrow_tx_hash.value ? main_params.escrow_tx_hash.value : (main_params.escrow_tx_sequence.value && !txSeqIsNumber ? main_params.escrow_tx_sequence.value : null));
	let txSequence = (txSeqIsNumber ? main_params.escrow_tx_sequence.value : null);
	let feeDrops = Fee(main_params.network.value);

	const fetchedInfo = await fetchEscrowInfo(main_params.escrow_account.value, txHash, txSequence);
	const escrow = fetchedInfo.escrow;
	const escrowAccount = escrow?.Account || main_params.escrow_account.value;
	const finishParams = { account: escrowAccount, txSequence: fetchedInfo.txSequence };

	if (fetchedInfo.withCondition) {
		const fulfil = await escrowFinishFulfillmentRequest({ escrowSrcAccountAddress: escrowAccount, escrowTestCondition: escrow?.Condition });
		if (fulfil?.data) {
			finishParams.conditionFulfillment = fulfil.data;
			finishParams.condition = escrow?.Condition;
			feeDrops = Fee(main_params.network.value, { withCondition: true, preimageSize: fulfil.preimageSize });
		}
	}
	finishParams.feeDrops = await ConfirmFeeValue(feeDrops);

	const tx = escrowSelfFinish(finishParams);

	await AddTransactionSequences(
		tx,
		{
			account: escrowAccount,
			client: fetchedInfo.client,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	showTransactionDetails(tx, escrow);

	const signedTransaction = await SignWithKeyPrompt({
		transaction: tx,
		secretKey: main_params.sign_key.value,
		secretKeyPromptOpts: main_params.sign_key,
		promptParamName: 'sign_key',
		promptAccountAddress: main_params.account.value
	});

	console.log('\nSIGNED TRANSACTION:');
	console.log(signedTransaction);

	if (fetchedInfo.client) { fetchedInfo.client.disconnect(); }
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
