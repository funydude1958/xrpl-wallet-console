///////////////////////////////////////////////////////////
//
// common_settings.js - common settings
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'common_settings';

const OFFLINE = false; // disables xrpl client connections.
const ESCROW_CONDITION_BCRYPT_HASH_ROUNDS = 10; // 4..31, default: 10.
const SHOW_MODULES_LOADED = false;

// https://xrpl.org/public-servers.html
const XRPL_SERVERS = {
	TEST: {
		address: 'wss://s.altnet.rippletest.net:51233',
		minFee: 10,
		indexMinTimeout: 20,
		indexMinTimeoutOffline: 100,
	},

	DEV: {
		address: 'wss://s.devnet.rippletest.net:51233',
		minFee: 10,
		indexMinTimeout: 20,
		indexMinTimeoutOffline: 100,
	},

	PUB: { // Public Mainnet XRP Ledger
		// address: 'wss://s1.ripple.com:443', // deprecated
		address: 'wss://xrplcluster.com/',
		minFee: 10, // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
		indexMinTimeout: 20,
		indexMinTimeoutOffline: 100,
	}
}

// Server aliases:
XRPL_SERVERS.LIVE = XRPL_SERVERS.MAIN = XRPL_SERVERS.MAINNET = XRPL_SERVERS.PUB;

const COLORS = {
	ResetColor: "\x1b[0m",
	Bright: "\x1b[1m",
	Dim: "\x1b[2m",
	Underscore: "\x1b[4m",
	Blink: "\x1b[5m",
	Reverse: "\x1b[7m",
	Hidden: "\x1b[8m",

	FgBlack: "\x1b[30m",
	FgRed: "\x1b[31m",
	FgGreen: "\x1b[32m",
	FgYellow: "\x1b[33m",
	FgBlue: "\x1b[34m",
	FgMagenta: "\x1b[35m",
	FgCyan: "\x1b[36m",
	FgWhite: "\x1b[37m",

	BgBlack: "\x1b[40m",
	BgRed: "\x1b[41m",
	BgGreen: "\x1b[42m",
	BgYellow: "\x1b[43m",
	BgBlue: "\x1b[44m",
	BgMagenta: "\x1b[45m",
	BgCyan: "\x1b[46m",
	BgWhite: "\x1b[47m"
}

const XrplServers = function () {
	return XRPL_SERVERS;
}

const XrplServerSettings = function (network) {
	return XRPL_SERVERS[network?.toUpperCase()];
}

const ShowLoadedModules = function () {
	return SHOW_MODULES_LOADED;
}

const EscrowConditionBcryptRounds = function () {
	return ESCROW_CONDITION_BCRYPT_HASH_ROUNDS;
}

const Colors = function () {
	return COLORS;
}

const IsOffline = function () {
	return OFFLINE;
}

if (require.main !== module) {
	if (ShowLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.XrplServers = XrplServers;
	exports.XrplServerSettings = XrplServerSettings;
	exports.ShowLoadedModules = ShowLoadedModules;
	exports.IsOffline = IsOffline;
	exports.Colors = Colors;
	exports.EscrowConditionBcryptRounds = EscrowConditionBcryptRounds;
}
