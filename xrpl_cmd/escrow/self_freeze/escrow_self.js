///////////////////////////////////////////////////////////
//
// escrow_self.js - escrow XRPL account funds to themselves
// syntax: node escrow_self [PUB|TEST|DEV] ACCOUNT ESCROW_XRP_AMOUNT ESCROW_RELEASE_TIME
//
// Every Escrow adds 2 XRP to your account reserve.
// Those 2 XRP are inaccessible as long as the Escrow exists.
// When the Escrow is finished or cancelled, the 2 XRP are returned to your available balance.
//
// You must supply FinishAfter, Condition, or both.
// With condition specified, the funds can only be delivered to the recipient if this condition is fulfilled.
// If the EscrowFinish transaction has no fulfillment, the transaction cost is the standard 10 drops.
// If the EscrowFinish transaction contains a fulfillment, the transaction cost is 330 drops of XRP plus another 10 drops for every 16 bytes in size of the preimage.
//
// The binary format for a condition is specified in the cryptoconditions RFC. See:
//   https://tools.ietf.org/html/draft-thomas-crypto-conditions-02#section-7.2
//   https://datatracker.ietf.org/doc/html/draft-thomas-crypto-conditions-02#section-6.1
//   https://xrpl.org/send-a-conditionally-held-escrow.html
//
// You can use XRP Ledger escrows as smart contracts that release XRP after a certain time has passed or after a cryptographic condition has been fulfilled.
// In this case, we'll use an escrow as a smart contract that releases XRP after a cryptographic condition has been fulfilled.
//
//
// !!! Be careful !!!
// !!! You could lock away your funds for years !!!
// ================================================
//
// Docs:
//   https://xrpl.org/escrow-object.html
//   https://xrpl.org/escrowcreate.html
//   https://xrpl.org/escrowfinish.html
//   https://xrpl.org/send-a-time-held-escrow.html
//   https://xrpl.org/use-an-escrow-as-a-smart-contract.html
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'escrow_self';

const { xrpToDrops } = require("xrpl");

const { quit, fail, defineMainParams, rippleEpochTimestamp, validateRippleEpochTimestamp, ledgerIndexMinTimeout, networkMinFee, showLoadedModules, ShowTransactionDetails, OutputJsonTransaction } = require('../../common/libs/common.js');
const { AddTransactionSequences } = require('../../common/sign.js');
const { escrowCreate, selfEscrowGeneralParams } = require('../escrow.js');
const { escrowPasswordProtectionOnRequest } = require('../escrow_condition.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	escrowXrpAmount: { id: 3, default: '', required: true },
	releaseTimeString: { id: 4, default: '', required: true, desc: 'Release the escrow after this time', example: '2022-10-20T00:00:00Z or 1year', type: ['datetime', 'timeoffset', 'drop_ms'] },
};

const EscrowSelfFreeze = function ({ account, releaseTimeString, amountDropsToEscrow, feeDrops }){
	const params = selfEscrowGeneralParams({ account, releaseTimeString, amountDropsToEscrow, feeDrops });

	return escrowCreate(params);
}

const EscrowSelfFreezeWithCondition = async function ({ account, releaseTimeString, amountDropsToEscrow, feeDrops, timeConditionCancelAfter }){
	const escrowParams = selfEscrowGeneralParams({ account, releaseTimeString, amountDropsToEscrow, feeDrops });

	const pswProtection = await escrowPasswordProtectionOnRequest({ account, releaseTimeString, skipAskCancelAfter: !!timeConditionCancelAfter });
	if (!pswProtection.protect || !pswProtection.condition?.hexCondition) {
		return escrowCreate(escrowParams);
	}

	let tsConditionCancelAfter;
	escrowParams.finishConditionSha256PublicHash = pswProtection.condition.hexCondition;

	timeConditionCancelAfter = timeConditionCancelAfter || pswProtection.timeConditionCancelAfter;
	if (timeConditionCancelAfter) {
		tsConditionCancelAfter = rippleEpochTimestamp(timeConditionCancelAfter);
		if (!validateRippleEpochTimestamp(tsConditionCancelAfter, timeConditionCancelAfter)) { fail("Invalid Ripple Epoch calculation for 'timeConditionCancelAfter'"); return {}; }
	}

	if (escrowParams.accountSrc === escrowParams.accountDest && !tsConditionCancelAfter) {
		delete escrowParams['cancelAfter']; // deny to cancel a self escrow with condition/password if no timeConditionCancelAfter specified
	}

	if (tsConditionCancelAfter) { escrowParams['cancelAfter'] = tsConditionCancelAfter; }

	return escrowCreate(escrowParams);
}

async function commandTxParams() {
	let txData = await EscrowSelfFreezeWithCondition({
		account: main_params.account.value,
		releaseTimeString: main_params.releaseTimeString.value,
		amountDropsToEscrow: xrpToDrops(main_params.escrowXrpAmount.value),
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
	const curDate = new Date(); console.log(`Current time: ${curDate.toISOString()}  |  ${curDate}\n`);
	await defineMainParams(main_params);

	const txParams = await commandTxParams();

	ShowTransactionDetails(txParams);

	quit( OutputJsonTransaction(txParams) );
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.EscrowSelfFreeze = EscrowSelfFreeze;
	exports.EscrowSelfFreezeWithCondition = EscrowSelfFreezeWithCondition;
}
