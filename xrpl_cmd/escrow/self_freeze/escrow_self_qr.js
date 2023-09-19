///////////////////////////////////////////////////////////
//
// escrow_self_qr.js - escrow XRPL account funds through offline QR-code with signed transaction
// syntax: node escrow_self_qr [PUB|TEST|DEV] ACCOUNT ESCROW_XRP_AMOUNT ESCROW_RELEASE_TIME SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
// Docs: https://xrpl.org/escrow.html
//       https://xrpl.org/escrow-object.html
//       https://js.xrpl.org/interfaces/EscrowCreate.html
///////////////////////////////////////////////////////////

'use strict';

const { XrplError, xrpToDrops, dropsToXrp, rippleTimeToISOTime } = require('xrpl');

const { fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ColoredText } = require('../../common/libs/common.js');
const { EscrowSelfFreezeWithCondition } = require('./escrow_self.js');
const { AddTransactionSequences, Wallet } = require('../../common/sign.js');
const { SignQR } = require('../../common/sign_qr.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	escrowXrpAmount: { id: 3, default: '', required: true },
	releaseTimeString: { id: 4, default: '', required: true, desc: 'Release the escrow after this time', example: '2022-10-20T00:00:00Z or 1year', type: ['datetime', 'timeoffset', 'drop_ms'] },
	sign_key: { id: 5, default: '', required: true, desc: 'account secret seed/mnemonic phrase', scramble: true },

	source_account_sequence: { id: 6, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 7, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 8, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const tx = await EscrowSelfFreezeWithCondition({
		account: main_params.account.value,
		releaseTimeString: main_params.releaseTimeString.value,
		amountDropsToEscrow: xrpToDrops(main_params.escrowXrpAmount.value),
		feeDrops: networkMinFee(main_params.network.value) // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
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

function showTransactionDetails(tx) {
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
	const curDate = new Date(); console.log(`Current time: ${curDate.toISOString()}  |  ${curDate}\n`);
	await defineMainParams(main_params);

	await signWithQR();
}

main();
