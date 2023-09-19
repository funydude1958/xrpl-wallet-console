# XRPL wallet console
This is a Node.js command line (CLI) tool to interact with the XRP Ledger.

You can use it to manage your accounts or for test purposes to study interaction with the XRP Ledger.

## Features

- Generate new account (wallet) address in Offline mode (aka "paper wallet");
- Derive a wallet address from a Base58 encoded seed;
- Fetch account Escrows, Trustlines and other objects;
- Fetch account balance and general information;
- Set / Remove a Regular Key;
- Disable / Enable the Master Key;
- Change account settings;
- Delete account;
- Create / Finish / Cancel an Escrow with/without condition;
- Create a password protected Escrow (using the BCrypt algorithm);
- Fetch various information of rippled server;
- Fetch transaction Fee requirements;
- Make a payment;

## Offline features

You can create and sign a transaction offline on a standalone device and send it to an online device using a QR code, and then submit it to the XRP Ledger.

## How to install

### Pre-requisites

Make sure you have **nodejs** installed on your computer:
[https://www.npmjs.com/get-npm](https://www.npmjs.com/get-npm)
(nodejs allowes you to run Javascript code on your computer from the command line).

To see if you already have Node.js and npm installed and check the installed version, run the following commands:
```
node -v
npm -v
```
Please verify that the NodeJS version you are using is a _stable_ version.

**WARNING**
THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
As with any software, xrpl-wallet-console may contain errors that the author(s) was not aware of or did not have time to correct, due to which your funds may be irretrievably lost.
**Please read and verify transaction details before submitting it to the Ledger.**
**It is impossible to cancel a submitted transaction.**

### Installation guide

1. Download the source of this repository (using `git clone` or by downloading the zip).
2. Start your command line and go to the folder containing the source of this repository.
3. Install dependencies by running `npm install`

## Usage

1. Go to the `xrpl_cmd` subfolder - the root of the console.
2. Check out the settings in the `common/common_settings.js` file.
```
less common/common_settings.js
```
3. Try it:
```
node account_info/account_balance
```

### Online signing and submitting
***!!! CAUTION !!!***
***Be careful when using keys on a device connected to the Internet or used by other people! Your keys can be stolen instantly.***

To sign and submit immediately, run files ending in `_submit`

Example:
```
node account_settings/xrp_income_disallow_submit
```
Check results:
```
node account_info/account_info
```

### Offline signing
To sign and generate a QR code, run files ending in `_qr`

Once the transaction is signed, your browser will open to display a QR code containing the signed data.

Example:
```
node account_settings/xrp_income_disallow_qr
```

### Submitting a transaction signed offline
This operation will only require a ready-made encoded transaction data.
No keys or account addresses are required.
```
node common/submit_send
```
Before you submit it to the XRP Ledger, you will be given the details of the transaction and will be required to confirm that it should be sent to the blockchain.

## CLI structure
_Note: each file contains a short description and links to useful docs._
_Just read these files with usual text editor._

```
xrpl_cmd
+-- common
|   +-- common_settings
|   +-- sign
|   +-- sign_qr
|   +-- submit_send
|   +-- qr
|   +-- libs
|       `-- ...
|
+-- account_new
|   +-- new
|
+-- account_info
|   +-- account_balance
|   +-- account_currencies
|   +-- account_escrows
|   +-- account_info
|   +-- account_lines
|   +-- account_objects
|   +-- account_transactions
|
+-- account_key
|   +-- set_key
|   +-- set_key_qr
|   +-- set_key_submit
|   +-- remove_key_qr
|   +-- remove_key_submit
|   +-- master_key_disable_qr
|   +-- master_key_disable_submit
|   +-- master_key_enable_qr
|   +-- master_key_enable_submit
|
+-- account_delete
|   +-- account_delete
|   +-- account_delete_qr
|   (there's no "_submit" command for a reason)
|
+-- account_settings
|   +-- list_set_flags
|   +-- account_set
|   +-- deposit_auth_disable_qr
|   +-- deposit_auth_disable_submit
|   +-- deposit_auth_enable_qr
|   +-- deposit_auth_enable_submit
|   +-- xrp_income_disallow_qr
|   +-- xrp_income_disallow_submit
|   +-- xrp_income_allow_qr
|   +-- xrp_income_allow_submit
|
+-- escrow
|   +-- escrow
|   +-- escrow_cancel
|   +-- escrow_finish
|   +-- self_freeze
|       +-- escrow_self
|       +-- escrow_self_qr
|       +-- escrow_self_submit
|       +-- escrow_self_finish_qr
|       +-- escrow_self_finish_submit
|       +-- escrow_self_cancel_qr
|       +-- escrow_self_cancel_submit
|
+-- ledger
|   +-- server_fee
|   +-- server_info
|   +-- server_state
|
+-- payment
|   +-- payment
|   +-- payment_qr
|   +-- payment_submit
|
+-- secret2address
|   +-- address.js
|
+-- trustline
|   +-- list_trust_flags
|   +-- trustline_set
|   +-- trustline_set_qr
|   +-- trustline_set_submit
|   +-- trustline_remove_qr
|   +-- trustline_remove_submit
```

## Useful links

### The Core
- [rippled daemon](https://github.com/XRPLF/rippled)
The server software that powers the XRP Ledger.

- [CLIO API Server](https://github.com/XRPLF/clio)
Clio is optimized for RPC calls, over WebSocket or JSON-RPC.

### Libraries and manuals
- [xrpl.js library manual](https://js.xrpl.org/index.html)

- [XRPL Client Libraries](https://xrpl.org/client-libraries.html)

- [XRPL Account prefixes](https://xrpl.org/base58-encodings.html)

- [Transaction Common Fields](https://xrpl.org/transaction-common-fields.html)

- [Reliable Transaction Submission](https://xrpl.org/reliable-transaction-submission.html)

### XRP Faucets for Testnet and Devnet
Get some test funds for development on the test network.
https://xrpl.org/xrp-testnet-faucet.html

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/funydude1958/xrpl-wallet-console

## License

Unless stated elsewhere, file headers or otherwise, the license as stated in the [LICENSE] file.
