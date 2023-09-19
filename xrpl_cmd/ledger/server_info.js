///////////////////////////////////////////////////////////
//
// server_info.js - asks the server for a human-readable version of various information about the rippled server 
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'server_info';

const { quit, fail, defineMainParams, XrplClient } = require('../common/libs/common.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
}

const ServerInfo = async function ({ network, xrplAddress, client }) {
	let lclient, info;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Server Info...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request({ command: 'server_info' });
		response.then(
			result => {
				info = result;
			},
			error => {
				fail(`Error: ${error}`);
			}
		)
		await response;

	} catch(err) {
		fail(err);

	} finally {
		if (!client && lclient) { lclient.disconnect(); }
	}

	if (!info) { fail('Unable to fetch Server Info'); }

	return info
}

async function main(){
	await defineMainParams(main_params);

	const info = await ServerInfo({ network: main_params.network.value });
	console.log(info);

	if (info.result?.info?.last_close) { console.log('\nLAST CLOSE:'); console.log(info.result?.info?.last_close); } 
	if (info.result?.info?.reporting) { console.log('\nREPORTING:'); console.log(info.result?.info?.reporting); } 
	if (info.result?.info?.state_accounting) { console.log('\nState Accounting:'); console.log(info.result?.info?.state_accounting); } 
	if (info.result?.info?.validated_ledger) { console.log('\nValidated Ledger:'); console.log(info.result?.info?.validated_ledger); } 

	if (info.result?.warnings) { console.log('\nSERVER WARNINGS:'); console.log(info.result?.warnings); } 

	quit(`\n${JSON.stringify(info)}`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.ServerInfo = ServerInfo;
}
