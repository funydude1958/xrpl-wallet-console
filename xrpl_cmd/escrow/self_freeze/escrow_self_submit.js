///////////////////////////////////////////////////////////
//
// escrow_self_submit.js - escrow XRPL account with online transaction submit
// syntax: node escrow_self_submit [PUB|TEST|DEV] ACCOUNT ESCROW_XRP_AMOUNT ESCROW_RELEASE_TIME SEED_KEY
//
// Docs: https://xrpl.org/escrow.html
//       https://xrpl.org/escrow-object.html
//       https://js.xrpl.org/interfaces/EscrowCreate.html
///////////////////////////////////////////////////////////

'use strict';

const { xrpToDrops, dropsToXrp, rippleTimeToISOTime } = require('xrpl');

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ColoredText } = require('../../common/libs/common.js');
const { Submit } = require('../../common/submit_send.js');
const { EscrowSelfFreezeWithCondition } = require('./escrow_self.js');
const { AddTransactionSequences, SignWithKeyPrompt } = require('../../common/sign.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	escrowXrpAmount: { id: 3, default: '', required: true },
	releaseTimeString: { id: 4, default: '', required: true, desc: 'Release the escrow after this time', example: '2022-10-20T00:00:00Z or 1year', type: ['datetime', 'timeoffset', 'drop_ms'] },
	key: { id: 5, default: '', required: true, desc: 'account secret seed/mnemonic phrase', scramble: true },
}

async function buildTransaction() {
	const tx = await EscrowSelfFreezeWithCondition({
		account: main_params.account.value,
		releaseTimeString: main_params.releaseTimeString.value,
		amountDropsToEscrow: xrpToDrops(main_params.escrowXrpAmount.value),
		feeDrops: networkMinFee(main_params.network.value), // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
	});

	await AddTransactionSequences(
		tx,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	showTransactionDetails(tx);

	const signedTransaction = await SignWithKeyPrompt({
		transaction: tx,
		secretKey: main_params.key.value,
		secretKeyPromptOpts: main_params.key,
		promptParamName: 'key',
		promptAccountAddress: main_params.account.value
	});

	console.log('\nSIGNED TRANSACTION:');
	console.log(signedTransaction);

	return signedTransaction
}

async function signAndSubmit() {
	const transaction = await buildTransaction();

	await Submit(transaction.tx_blob, { network: main_params.network.value });
}

function showTransactionDetails (tx) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Amount: ${ColoredText(`${dropsToXrp(parseInt(tx.Amount, 10))} XRP`, { color: 'FgGreen' })}`);
	console.log(`Fee: ${ColoredText(`${tx.Fee} drops`, { color: 'FgGreen' })}`);
	if (tx.FinishAfter) { const tm = rippleTimeToISOTime(tx.FinishAfter); console.log(`Finish after: ${ColoredText(`${tm} (yy-mm-dd)  |  ${new Date(tm)}`, { color: 'FgGreen' })}`); }
	if (tx.CancelAfter && tx.FinishAfter !== tx.CancelAfter) { const tm = rippleTimeToISOTime(tx.CancelAfter); console.log(`Cancel after: ${ColoredText(`${tm} (yy-mm-dd)  |  ${new Date(tm)}`, { color: 'FgGreen' })}`); }
	console.log('=========');
}

async function main(){
	const curDate = new Date(); console.log(`\nCurrent time: ${curDate.toISOString()}  |  ${curDate}\n`);
	await defineMainParams(main_params);

	await signAndSubmit();
}

main();
