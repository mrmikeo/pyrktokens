/*
*
* Pyrk Tokens - Version 1.1.1
*
*
* A simplified token management system for the Pyrk network
*
* pyrkSchema
*
*/

/* Use Interfaces for Objects */

const implementjs			= require('implement-js')
const implement				= implementjs.default
const { Interface, type }	= implementjs
const Big					= require('big.js');
const SparkMD5				= require('spark-md5');  // Faster than crypto

var pyrkSchema = /** @class */ (function () 
{

	/**
	* Variables
	*/

	const activationHeight = 28000;
	
	const schemaVersion = 1;

	const PyrkTransactionType = {
		"GENESIS": "GENESIS", 
		"SEND": "SEND",
		"BURN": "BURN",
		"PAUSE": "PAUSE",
		"RESUME": "RESUME",
		"NEWOWNER": "NEWOWNER",
		"ADDMETA": "ADDMETA",
		"AUTHMETA": "AUTHMETA",
		"REVOKEMETA": "REVOKEMETA"
	};
	
	const PyrkTransactionTypeHeight = {
		"GENESIS": 1, 
		"SEND": 1,
		"BURN": 1,
		"PAUSE": 1,
		"RESUME": 1,
		"NEWOWNER": 1,
		"ADDMETA": 1,
		"AUTHMETA": 1,
		"REVOKEMETA": 1
	};

	/**
	* It costs 5 Pyrk to create a token
	*/
	
	const PyrkGenesisCostHeight = {
		1: 5
	};
	
	/**
	* Don't allow these tickers
	*/
	
	const DeniedTickers = ['BTC', 'LTC', 'BCH', 'ETH', 'EOS', 'XRP', 'USDT', 'XMR', 'DASH', 'ETC', 'PYRK'];
	
	/**
	* Interfaces for Validation
	*/

	const PyrkTransactionOutput = Interface('PyrkTransactionOutput')({
		schema_version: type('number'),
		address: type('string'),
		amount: type('string'),
		paymentId: type('string')
	},{
		error: true,
		strict: true
	});

	const PyrkTransactionDetails = Interface('PyrkTransactionDetails')({
		schema_version: type('number'),
		transactionType: type('string'),
		senderAddress: type('string'),
		tokenIdHex: type('string'),
		versionType: type('number'),
		timestamp: type('string'),
		timestamp_unix: type('number'),
		symbol: type('string'),
		name: type('string'),
		genesisOrBurnQuantity: type('string'),
		sendOutput: type('object', PyrkTransactionOutput),
		fee_paid: type('string')
	},{
		error: true,
		strict: true
	});
	
	const PyrkTokenDetails = Interface('PyrkTokenDetails')({
		schema_version: type('number'),
		ownerAddress: type('string'),
		tokenIdHex: type('string'),
		versionType: type('number'),
		genesis_timestamp: type('string'),
		genesis_timestamp_unix: type('number'),
		symbol: type('string'),
		name: type('string'),
		documentUri: type('string'),
		logoUri: type('string'),
		genesisQuantity: type('string')
	},{
		error: true,
		strict: true
	});
	
	const PyrkTokenStats = Interface('PyrkTokenStats')({
		schema_version: type('number'),
		block_created_height: type('number'),
		block_created_id: type('string'),
		block_last_active_send: type('number'),
		creation_transaction_id: type('string'),
		qty_valid_meta_since_genesis: type('number'),
		qty_valid_txns_since_genesis: type('number'),
		qty_valid_token_addresses: type('number'),
		qty_valid_metaauth_addresses: type('number'),
		qty_token_minted: type('string'),
		qty_token_burned: type('string'),
		qty_token_circulating_supply: type('string')
	},{
		error: true,
		strict: true
	});
	
	const PyrkTokenObject = Interface('PyrkTokenObject')({
		schema_version: type('number'),
		type: type('string'),
		paused: type('boolean'),
		tokenDetails: type('object', PyrkTokenDetails),
		tokenStats: type('object', PyrkTokenStats),
		lastUpdatedBlock: type('number')
	},{
		error: true,
		strict: true
	});

	const PyrkAddressObject = Interface('PyrkAddressObject')({
		schema_version: type('number'),
		recordId: type('string'),
		address: type('string'),
		tokenIdHex: type('string'),
		isOwner: type('boolean'),
		isMetaAuth: type('boolean'),
		tokenBalance: type('string'),
		lastUpdatedBlock: type('number')
	},{
		error: true,
		strict: true
	});
	
	const PyrkTransactionObject = Interface('PyrkTransactionObject')({
		schema_version: type('number'),
		txid: type('string'),
		blockId: type('string'),
		blockHeight: type('number'),
		valid: type('boolean'),
		invalidReason: type('string'),
		transactionDetails: type('object', PyrkTransactionDetails)
	},{
		error: true,
		strict: true
	});

	
	const PyrkMetaDetails = Interface('PyrkMetaDetails')({
		schema_version: type('number'),
		posterAddress: type('string'),
		tokenIdHex: type('string'),
		timestamp: type('string'),
		timestamp_unix: type('number'),
		metaCode: type('number'),
		metaData: type('string')
	},{
		error: true,
		strict: true
	});
	
	const PyrkMetaObject = Interface('PyrkMetaObject')({
		schema_version: type('number'),
		txid: type('string'),
		blockId: type('string'),
		blockHeight: type('number'),
		metaDetails: type('object', PyrkMetaDetails)
	},{
		error: true,
		strict: true
	});

	
	/* Functions */

	function pyrkSchema() 
	{			
		return this;
	}
	
	pyrkSchema.prototype.getTransactionTypes = function ()
	{
		
		return PyrkTransactionType;
	
	};

	pyrkSchema.prototype.parseTransaction = function (transactionData, blockData, contractData, qdb)
	{
		
		return new Promise((resolve, reject) => {

			//var transactionData = txdata;
			//var blockData = bkdata;
			(async () => {

			
				if (contractData && blockData.height >= activationHeight)
				{
				
					/**
					* Some General Error Checking
					*/
				
					var validationcheck = true;
					var invalidreason = '';
				
					if (!PyrkTransactionType[contractData.transactiontype])
					{
						// Invalid Type
					
						validationcheck = false;
						invalidreason = 'Unknown Transaction Type';
				
					}
				
					if (PyrkTransactionTypeHeight[contractData.transactiontype] > blockData.height)
					{
						// Invalid Type
					
						validationcheck = false;
						invalidreason = 'Method not yet active';
				
					}

					// Let's set a maximum for the quantity field... 1 trillion and 1
					var maxqt = Big('184000000000');
				
				
					if (contractData.transactiontype == "GENESIS" || contractData.transactiontype == "SEND" || contractData.transactiontype == "BURN")
					{
				
						try {
					
							var testnumber = Big(contractData.realvalue);
					
							if (testnumber.lt(0) || testnumber.gt(maxqt))
							{
								// Quantity cannot be less than zero or more than maxqt

								validationcheck = false;
								invalidreason = 'Quantity cannot be less than zero or greater than ' + maxqt.toFixed(8);
				
							}
					
						
						} catch (e) {
					
							// Quantity is not a number

							validationcheck = false;
							invalidreason = 'Quantity is not a number';
					
						}
				
					}
				
					if (contractData.transactiontype == 'GENESIS')
					{
				
						// Check Transaction Cost
						var GenesisTransactionCost = Big(5);
						for(var costHeight in PyrkGenesisCostHeight)
						{
							console.log(costHeight + ": " + PyrkGenesisCostHeight[costHeight]);
				
							var bigCostHeight = Big(costHeight);
							var bigTestHeight = Big(blockData.height);
							if (bigTestHeight.gte(bigCostHeight))
							{
								GenesisTransactionCost = Big(PyrkGenesisCostHeight[costHeight]);
							}
						}

						if (GenesisTransactionCost.gt(contractData.feepaid))
						{
							validationcheck = false;
							invalidreason = 'Generation Fee unsufficient.  ' + GenesisTransactionCost.toFixed(8) + ' PYRK required';
						}
					
						if (contractData.tickercode.length < 1 || contractData.tickercode.length > 5)
						{
					
							// Symbol (Ticker) size issue.	Should be a string between 1 and 5 characters
					
							validationcheck = false;
							invalidreason = 'Ticker length issue.  Should be a string between 1 and 5 characters';
					
						}
			
						if (DeniedTickers.indexOf(contractData.tickercode.toUpperCase()) > -1) 
						{
					
							validationcheck = false;
							invalidreason = 'Ticker rejected.  This is a reserved ticker.';
						
						}

						if (contractData.tokenname.length < 1 || contractData.tokenname.length > 20)
						{
					
							// Token name size issue.  Should be a string between 3 and 24 characters
					
							validationcheck = false;
							invalidreason = 'Token name length issue.  Should be a string between 1 and 20 characters';
					
						}
				
					}
					else if (contractData.transactiontype == 'ADDMETA')
					{
				
						if (!contractData.metacode)
						{
					
							validationcheck = false;
							invalidreason = 'Token meta code issue.  Metacode is missing';
					
					
						}
					
					}
					else
					{

						var regtest = /[0-9A-Fa-f]{22}/g;

						if (!contractData.tokenid)
						{
					
							// ID variable is required for BURN, SEND, etc.
				
							validationcheck = false;
							invalidreason = 'TokenID variable is required for all except GENESIS';
						
						}
						else if (!regtest.test(contractData.tokenid))
						{
					
							// ID variable should be a hexidecimal number
						
							validationcheck = false;
							invalidreason = 'TokenID variable should be a 22 character hexidecimal number';
											
						}
				
					}
				
					if (validationcheck === false)
					{

						var TransactionOutput = {
							schema_version: schemaVersion,
							address: transactionData.sender,
							amount: '0'
						}

						var TransactionDetails = {
							schema_version: schemaVersion,
							transactionType: 'ERROR',
							senderAddress: contractData.senderaddress,
							tokenIdHex: '',
							versionType: 1,
							timestamp: (new Date(transactionData.time * 1000)).toJSON(),
							timestamp_unix: transactionData.time,
							symbol: '',
							name: '',
							genesisOrBurnQuantity: '0',
							sendOutput: TransactionOutput,
							fee_paid: Big(contractData.feepaid).toFixed(8)
						}
				
						var TransactionObject = {
							schema_version: schemaVersion,
							txid: transactionData.id,
							blockId: blockData.id,
							blockHeight: blockData.height,
							valid: false,
							invalidReason: invalidreason,
							transactionDetails: TransactionDetails
						}

						await qdb.insertDocument('transactions', TransactionObject);
					
						await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);
												
						resolve(false);
					
					}
					else
					{
				
						// End Error Checking
				
						if (contractData.transactiontype == 'GENESIS')
						{
							// New Token Request
					
							var failed = false;

							var genesisAmount = Big(contractData.realvalue);

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.senderaddress,
								amount: genesisAmount.toFixed(8),
								paymentId: contractData.paymentid
							}

							try 
							{
					
								implement(PyrkTransactionOutput)(TransactionOutput);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}
					
							/**
							* Token ID Generation
							*/
						
							var tidpart1 = Buffer.from(contractData.senderaddress, 'utf8').toString('hex').substr(0,4);
							var tidpart2 = blockData.hash.substr(-9);
							var tidpart3 = transactionData.txid.substr(0,9);
					
							var tokenId = tidpart1 + '' + tidpart2 + '' + tidpart3;


							var tSymbol = contractData.tickercode.toUpperCase();
							var tName = contractData.tokenname;

							var TransactionDetails = {
								schema_version: schemaVersion,
								transactionType: 'GENESIS',
								senderAddress: contractData.senderaddress,
								tokenIdHex: tokenId,
								versionType: 1,
								timestamp: (new Date(transactionData.time * 1000)).toJSON(),
								timestamp_unix: transactionData.time,
								symbol: tSymbol,
								name: tName,
								genesisOrBurnQuantity: genesisAmount.toFixed(8),
								sendOutput: TransactionOutput,
								fee_paid: Big(contractData.feepaid).toFixed(8)
							}

							try 
							{
					
								implement(PyrkTransactionDetails)(TransactionDetails);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}
					
							var TokenDetails = {
								schema_version: schemaVersion,
								ownerAddress: contractData.senderaddress,
								tokenIdHex: tokenId,
								versionType: 1,
								genesis_timestamp: (new Date(transactionData.time * 1000)).toJSON(),
								genesis_timestamp_unix: transactionData.time,
								symbol: tSymbol,
								name: tName,
								documentUri: contractData.documenturi,
								logoUri: contractData.logouri,
								genesisQuantity: genesisAmount.toFixed(8)
							}

							try 
							{
					
								implement(PyrkTokenDetails)(TokenDetails);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}

					
							var TokenStats = {
								schema_version: schemaVersion,
								block_created_height: blockData.height,
								block_created_id: blockData.hash,
								block_last_active_send: 0,
								creation_transaction_id: transactionData.txid,
								qty_valid_txns_since_genesis: 0,
								qty_valid_meta_since_genesis: 0,
								qty_valid_token_addresses: 1,
								qty_valid_metaauth_addresses: 1,
								qty_token_minted: genesisAmount.toFixed(8),
								qty_token_burned: "0",
								qty_token_circulating_supply: genesisAmount.toFixed(8)
							}
					
							try 
							{
					
								implement(PyrkTokenStats)(TokenStats);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}



							var TokenObject = {
								schema_version: schemaVersion,
								type: 'TYPE1',
								paused: false,
								tokenDetails: TokenDetails,
								tokenStats: TokenStats,
								lastUpdatedBlock: blockData.height
							}

							try 
							{
					
								implement(PyrkTokenObject)(TokenObject);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}

							var rawRecordId = contractData.senderaddress + '.' + tokenId;
							var recordId = SparkMD5.hash(rawRecordId);
					
							var AddressObject = {
								schema_version: schemaVersion,
								recordId: recordId,
								address: contractData.senderaddress,
								tokenIdHex: tokenId,
								isOwner: true,
								isMetaAuth: true,
								tokenBalance: genesisAmount.toFixed(8),
								lastUpdatedBlock: blockData.height
							}

							try 
							{
					
								implement(PyrkAddressObject)(AddressObject);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}
					
					
							var TransactionObject = {
								schema_version: schemaVersion,
								txid: transactionData.txid,
								blockId: blockData.hash,
								blockHeight: blockData.height,
								valid: true,
								invalidReason: '',
								transactionDetails: TransactionDetails
							}
					
							try 
							{
					
								implement(PyrkTransactionObject)(TransactionObject);

							} catch (e) {
					
								console.log(e);
								failed = true;
					
							}
					
							console.log('-------------------------------------');
							console.log('Token Object');
							console.log(TokenObject);
							console.log('Address Object');
							console.log(AddressObject);
							console.log('Transaction Object');
							console.log(TransactionObject);
							console.log('-------------------------------------');
					
							if (failed === false)
							{
					
								await qdb.insertDocument('tokens', TokenObject);
						
								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'tokens', {}, TokenObject);

						
								await qdb.insertDocument('addresses', AddressObject);
						
								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'addresses', {}, AddressObject);

						
								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								resolve(true);
											
							}
							else
							{

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'GENESIS',
									senderAddress: contractData.senderaddress,
									tokenIdHex: '',
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Genesis Failed',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								resolve(false);
												
							}
					
						}
						else if (contractData.transactiontype == 'SEND')
						{
							/**
							* Send tokens to another address
							*/
					
							var failed = false;

							var sendAmount = Big(contractData.realvalue);

							var tokenId = contractData.tokenid;
						
							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.recipient,
								amount: sendAmount.toFixed(8),
								paymentId: contractData.paymentid
							}

							try 
							{
				
								implement(PyrkTransactionOutput)(TransactionOutput);

							} catch (e) {
					
								console.log(e);
								failed = true;
				
							}

							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;
					
								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.recipient,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'SEND',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Send Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else
							{
						
						
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;


								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'SEND',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								try 
								{
				
									implement(PyrkTransactionDetails)(TransactionDetails);

								} catch (e) {
				
									console.log(e);
									failed = true;
				
								}


								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: true,
									invalidReason: '',
									transactionDetails: TransactionDetails
								}
				
								try 
								{
				
									implement(PyrkTransactionObject)(TransactionObject);

								} catch (e) {
					
									console.log(e);
									failed = true;
				
								}
				
								console.log('-------------------------------------');
								console.log('Transaction Object');
								console.log(TransactionObject);
								console.log('-------------------------------------');
				
								if (failed === false)
								{
						
									// Sender //

									var srawRecordId = contractData.senderaddress + '.' + tokenId;
									var srecordId = SparkMD5.hash(srawRecordId);
						
									var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
									if (findSenderAddress == null)
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.recipient,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'SEND',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Send Failed - Sender Address Not Found',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										console.log('Error: Sender addresses not found');
							
										resolve(false);
						
									}
									else if (Big(findSenderAddress.tokenBalance).lt(sendAmount))
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.recipient,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'SEND',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Send Failed - Insufficient Funds',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										console.log('Error: Sender does not have enough funds');
							
										resolve(false);
						
									}
									else if (findToken.paused == true)
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.recipient,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'SEND',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Send Failed - Token is Paused',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										console.log('Error: Token is paused');
							
										resolve(false);
						
									}
									else
									{
						
										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var senderbalance = await qdb.findDocumentBigSum('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true, "transactionDetails.sendOutput.address": findSenderAddress.address}, 'transactionDetails.sendOutput.amount');

										var senderbalancesend = await qdb.findDocumentBigSum('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true, "transactionDetails.senderAddress": findSenderAddress.address, "transactionDetails.transactionType": "SEND"}, 'transactionDetails.sendOutput.amount');

										var totalsenderbalance = Big(senderbalance).minus(senderbalancesend);
			
										await qdb.updateDocument('addresses', {"recordId": srecordId }, {"tokenBalance": totalsenderbalance.toFixed(8), "lastUpdatedBlock": blockData.height });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": srecordId }, {"tokenBalance": totalsenderbalance.toFixed(0), "lastUpdatedBlock": blockData.height });


										// Recipient
						
										var rrawRecordId = contractData.recipient + '.' + tokenId;
										var rrecordId = SparkMD5.hash(rrawRecordId);
						
										var findRecipientAddress = await qdb.findDocument('addresses', {"recordId": rrecordId});
										if (findRecipientAddress == null)
										{
						
											// Create New Record
															
											var AddressObject = {
												schema_version: schemaVersion,
												recordId: rrecordId,
												address: contractData.recipient,
												tokenIdHex: tokenId,
												isOwner: false,
												isMetaAuth: false,
												tokenBalance: sendAmount.toFixed(8),
												lastUpdatedBlock: blockData.height
											}

											try 
											{
				
												implement(PyrkAddressObject)(AddressObject);

											} catch (e) {
				
												console.log(e);
				
											}
							

											await qdb.insertDocument('addresses', AddressObject);

											await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'addresses', {}, AddressObject);

															
										}
										else 
										{
						
											// Update Record
						
											var senderbalance = await qdb.findDocumentBigSum('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true, "transactionDetails.sendOutput.address": findRecipientAddress.address}, 'transactionDetails.sendOutput.amount');

											var senderbalancesend = await qdb.findDocumentBigSum('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true, "transactionDetails.senderAddress": findRecipientAddress.address, "transactionDetails.transactionType": "SEND"}, 'transactionDetails.sendOutput.amount');

											var totalsenderbalance = Big(senderbalance).minus(senderbalancesend);

											await qdb.updateDocument('addresses', {"recordId": rrecordId }, {"tokenBalance": totalsenderbalance.toFixed(8), "lastUpdatedBlock": blockData.height });

											await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": rrecordId }, {"tokenBalance": totalsenderbalance.toFixed(0), "lastUpdatedBlock": blockData.height });


										}
						
						
						
										var newTokenAddrs = await qdb.findDocumentCount('addresses', {"tokenIdHex": tokenId });

										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });

						
										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.block_last_active_send": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_token_addresses": newTokenAddrs });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.block_last_active_send": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_token_addresses": newTokenAddrs });


										resolve(true);
								
									}
										
								}
								else
								{


									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.recipient,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'SEND',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Send Failed - General Error',
										transactionDetails: TransactionDetails
									}


									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									resolve(false);
					
								}
						
							}
				
						}
						else if (contractData.transactiontype  == 'BURN')
						{
							// Burn tokens

							var failed = false;

							var burnAmount = Big(contractData.realvalue).times(-1);
							var absBurnAmount = Big(contractData.realvalue);

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.senderaddress,
								amount: burnAmount.toFixed(8),
								paymentId: contractData.paymentid
							}

							try 
							{
				
								implement(PyrkTransactionOutput)(TransactionOutput);

							} catch (e) {
				
								console.log(e);
								failed = true;
				
							}
				
							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							var srawRecordId = contractData.senderaddress + '.' + tokenId;
							var srecordId = SparkMD5.hash(srawRecordId);
						
							var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});

							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;

					
								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'BURN',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Burn Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);

								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else if (findToken.tokenDetails.ownerAddress != contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'BURN',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Burn Failed - Not Owner',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Burn failed:  Not the token owner');
						
								resolve(false);
						
							}
							else if (findToken.paused == true)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'BURN',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Burn Failed - Token is Paused',
									transactionDetails: TransactionDetails
								}
							

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Burn failed:  Token is paused');
						
								resolve(false);
						
							}
							else
							{
				
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								if (findSenderAddress == null)
								{

									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.senderaddress,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'BURN',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Burn Failed - Address Not Found',
										transactionDetails: TransactionDetails
									}
								

									await qdb.insertDocument('transactions', TransactionObject);
						
									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Sender addresses not found');
						
									resolve(false);
						
								}
								else if (Big(findSenderAddress.tokenBalance).lt(absBurnAmount))
								{
						
									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.senderaddress,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'BURN',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Burn Failed - Insufficient Funds',
										transactionDetails: TransactionDetails
									}


									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Sender does not have enough funds');
						
									resolve(false);
						
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'BURN',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: burnAmount.toFixed(8),
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									try 
									{
				
										implement(PyrkTransactionDetails)(TransactionDetails);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}


									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: true,
										invalidReason: '',
										transactionDetails: TransactionDetails
									}
				
									try 
									{
				
										implement(PyrkTransactionObject)(TransactionObject);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}
				
									console.log('-------------------------------------');
									console.log('Transaction Object');
									console.log(TransactionObject);
									console.log('-------------------------------------');
				
									if (failed === false)
									{

										var rawRecordId = contractData.senderaddress + '.' + tokenId;
										var recordId = SparkMD5.hash(rawRecordId);
						
										var findAddress = await qdb.findDocument('addresses', {"recordId": recordId});
										if (findAddress == null)
										{
						
											console.log('Error: Address not found');
											resolve(false);
											return;
						
										}
						
										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });

										var senderbalance = await qdb.findDocumentBigSum('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true, "transactionDetails.sendOutput.address": findAddress.address}, 'transactionDetails.sendOutput.amount');

										var senderbalancesend = await qdb.findDocumentBigSum('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true, "transactionDetails.senderAddress": findAddress.address, "transactionDetails.transactionType": "SEND"}, 'transactionDetails.sendOutput.amount');

										var totalsenderbalance = Big(senderbalance).minus(senderbalancesend);

										await qdb.updateDocument('addresses', {"recordId": recordId }, {"tokenBalance": totalsenderbalance.toFixed(8), "lastUpdatedBlock": blockData.height });
						
										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": recordId }, {"tokenBalance": totalsenderbalance.toFixed(0), "lastUpdatedBlock": blockData.height });

						
										var totalBurned = Big(findToken.tokenStats.qty_token_burned).plus(absBurnAmount);
										var circSupply = Big(findToken.tokenStats.qty_token_circulating_supply).plus(burnAmount);
						
						
										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_token_burned": totalBurned.toFixed(8), "tokenStats.qty_token_circulating_supply": circSupply.toFixed(8)});

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_token_burned": totalBurned.toFixed(8), "tokenStats.qty_token_circulating_supply": circSupply.toFixed(8)});


										resolve(true);
										
									}
									else
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.senderaddress,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'BURN',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Burn Failed - General Error',
											transactionDetails: TransactionDetails
										}


										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
					
									}
						
								}
						
							}

						}
						else if (contractData.transactiontype  == 'PAUSE')
						{
					
							// Pause Contract

							var failed = false;

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.senderaddress,
								amount: "0",
								paymentId: contractData.paymentid
							}

							try 
							{
				
								implement(PyrkTransactionOutput)(TransactionOutput);

							} catch (e) {
				
								console.log(e);
								failed = true;
				
							}

							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							var srawRecordId = contractData.senderaddress + '.' + tokenId;
							var srecordId = SparkMD5.hash(srawRecordId);
						
							var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
						
							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'PAUSE',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Pause Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}


								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else if (findToken.tokenDetails.ownerAddress != contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;
					
					
								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'PAUSE',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Pause Failed - Not Owner',
									transactionDetails: TransactionDetails
								}


								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Pause failed:	Not the token owner');
						
								resolve(false);
						
							}
							else
							{
				
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;


								if (findSenderAddress == null)
								{

									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.senderaddress,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'PAUSE',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Pause Failed - Address Not Found',
										transactionDetails: TransactionDetails
									}
							

									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Sender address not found');
						
									resolve(false);
						
								}
								else if (findToken.paused == true)
								{

									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.senderaddress,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'PAUSE',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Pause Failed - Already Paused',
										transactionDetails: TransactionDetails
									}
								
									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Contract is already paused');
						
									resolve(false);
						
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'PAUSE',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}
								

									try 
									{
				
										implement(PyrkTransactionDetails)(TransactionDetails);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}


									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: true,
										invalidReason: '',
										transactionDetails: TransactionDetails
									}
				
									try 
									{
				
										implement(PyrkTransactionObject)(TransactionObject);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}
				
									console.log('-------------------------------------');
									console.log('Transaction Object');
									console.log(TransactionObject);
									console.log('-------------------------------------');
				
									if (failed === false)
									{

										var rawRecordId = contractData.senderaddress + '.' + tokenId;
										var recordId = SparkMD5.hash(rawRecordId);
						
										var findAddress = await qdb.findDocument('addresses', {"recordId": recordId});
										if (findAddress == null)
										{
						
											console.log('Error: Address not found');
											resolve(false);
											return;
						
										}
						
										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });
						
						
										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"paused": true, "lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns});

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"paused": true, "lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns});


										resolve(true);
										
									}
									else
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.senderaddress,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'PAUSE',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Pause Failed - General Error',
											transactionDetails: TransactionDetails
										}


										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
					
									}
						
								}
						
							}
					
						}
						else if (contractData.transactiontype  == 'RESUME')
						{
					
							// Resume Contract

							var failed = false;

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.senderaddress,
								amount: "0",
								paymentId: contractData.paymentid
							}

							try 
							{
				
								implement(PyrkTransactionOutput)(TransactionOutput);

							} catch (e) {
				
								console.log(e);
								failed = true;
				
							}
				
							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });
						
							var srawRecordId = contractData.senderaddress + '.' + tokenId;
							var srecordId = SparkMD5.hash(srawRecordId);
						
							var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
						
							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'RESUME',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Resume Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}


								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else if (findToken.tokenDetails.ownerAddress != contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;
					
								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.senderaddress,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'RESUME',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Resume Failed - Not Owner',
									transactionDetails: TransactionDetails
								}
					

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Resume failed:	 Not the token owner');
						
								resolve(false);
						
							}
							else
							{
				
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								if (findSenderAddress == null)
								{

									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.senderaddress,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'RESUME',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Resume Failed - Address Not Found',
										transactionDetails: TransactionDetails
									}
							

									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Sender address not found');
						
									resolve(false);
						
								}
								else if (findToken.paused == false)
								{
						
									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.senderaddress,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'RESUME',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Resume Failed - Not Paused',
										transactionDetails: TransactionDetails
									}
						

									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Contract is not paused');
						
									resolve(false);
						
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'RESUME',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									try 
									{
				
										implement(PyrkTransactionDetails)(TransactionDetails);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}


									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: true,
										invalidReason: '',
										transactionDetails: TransactionDetails
									}
				
									try 
									{
				
										implement(PyrkTransactionObject)(TransactionObject);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}
				
									console.log('-------------------------------------');
									console.log('Transaction Object');
									console.log(TransactionObject);
									console.log('-------------------------------------');
				
									if (failed === false)
									{

										var rawRecordId = contractData.senderaddress + '.' + tokenId;
										var recordId = SparkMD5.hash(rawRecordId);
						
										var findAddress = await qdb.findDocument('addresses', {"recordId": recordId});
										if (findAddress == null)
										{
						
											console.log('Error: Address not found');
											resolve(false);
											return;
						
										}
						
										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });
						
						
										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"paused": false, "lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns});

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"paused": false, "lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns});


										resolve(true);
										
									}
									else
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.senderaddress,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'RESUME',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Resume Failed - General Error',
											transactionDetails: TransactionDetails
										}
								

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
					
									}
						
								}
						
							}

						}
						else if (contractData.transactiontype  == 'NEWOWNER')
						{
					
							// Assign new ownership of token

							var failed = false;

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.newowner,
								amount: "0",
								paymentId: contractData.paymentid
							}

							try 
							{
				
								implement(PyrkTransactionOutput)(TransactionOutput);

							} catch (e) {
				
								console.log(e);
								failed = true;
				
							}

							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.newowner,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'NEWOWNER',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token NewOwner Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}


								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else if (findToken.tokenDetails.ownerAddress != contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.newowner,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'NEWOWNER',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token NewOwner Failed - Not Owner',
									transactionDetails: TransactionDetails
								}
							

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('New Ownership failed:	Not the token owner');
						
								resolve(false);
						
							}
							else if (findToken.paused == true)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;
					
								var TransactionOutput = {
									schema_version: schemaVersion,
									address: contractData.newowner,
									amount: "0",
									paymentId: contractData.paymentid
								}

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'NEWOWNER',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token NewOwner Failed - Token is Paused',
									transactionDetails: TransactionDetails
								}
					

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('New ownership failed:	Token is paused');
						
								resolve(false);
						
							}
							else
							{
				
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;



								var srawRecordId = contractData.senderaddress + '.' + tokenId;
								var srecordId = SparkMD5.hash(srawRecordId);
						
								var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
						

								if (findSenderAddress == null)
								{
						
									var TransactionOutput = {
										schema_version: schemaVersion,
										address: contractData.newowner,
										amount: "0",
										paymentId: contractData.paymentid
									}

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'NEWOWNER',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token NewOwner Failed - Address Not Found',
										transactionDetails: TransactionDetails
									}


									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Sender address not found');
						
									resolve(false);
						
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'NEWOWNER',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}
								

									try 
									{
				
										implement(PyrkTransactionDetails)(TransactionDetails);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}


									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: true,
										invalidReason: '',
										transactionDetails: TransactionDetails
									}
				
									try 
									{
				
										implement(PyrkTransactionObject)(TransactionObject);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}
				
									console.log('-------------------------------------');
									console.log('Transaction Object');
									console.log(TransactionObject);
									console.log('-------------------------------------');
				
									if (failed === false)
									{


										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });

										// Sender no longer owner

										await qdb.updateDocument('addresses', {"recordId": srecordId }, {"isOwner": false, "isMetaAuth": false, "lastUpdatedBlock": blockData.height });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": srecordId }, {"isOwner": false, "isMetaAuth": false, "lastUpdatedBlock": blockData.height });


										// Recipient
						
										var rrawRecordId = contractData.newowner + '.' + tokenId;
										var rrecordId = SparkMD5.hash(rrawRecordId);
						
										var findRecipientAddress = await qdb.findDocument('addresses', {"recordId": rrecordId});
									
										if (findRecipientAddress == null)
										{
						
											// Create New Record
															
											var AddressObject = {
												schema_version: schemaVersion,
												recordId: rrecordId,
												address: contractData.newowner,
												tokenIdHex: tokenId,
												isOwner: true,
												isMetaAuth: true,
												tokenBalance: "0",
												lastUpdatedBlock: blockData.height
											}

											try 
											{
				
												implement(PyrkAddressObject)(AddressObject);

											} catch (e) {
				
												console.log(e);
				
											}


											await qdb.insertDocument('addresses', AddressObject);

											await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'addresses', {}, AddressObject);

										
															
										}
										else 
										{
						
											// Update Record
											await qdb.updateDocument('addresses', {"recordId": rrecordId }, {"isOwner": true, "isMetaAuth": true, "lastUpdatedBlock": blockData.height });

											await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": rrecordId }, {"isOwner": true, "isMetaAuth": true, "lastUpdatedBlock": blockData.height });


										}

										//
													
										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"tokenDetails.ownerAddress": transactionData.recipient, "lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns});

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"tokenDetails.ownerAddress": transactionData.recipient, "lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns});


										resolve(true);
										
									}
									else
									{

										var TransactionOutput = {
											schema_version: schemaVersion,
											address: contractData.newowner,
											amount: "0",
											paymentId: contractData.paymentid
										}

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'NEWOWNER',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token NewOwner Failed - General Error',
											transactionDetails: TransactionDetails
										}
								

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
					
									}
						
								}
						
							}

						}
						else if (contractData.transactiontype  == 'ADDMETA')
						{
					
							// Add Meta Information to a Token

							var failed = false;

						
							var metaCode = contractData.metacode;
							var metaData = contractData.metavalue;

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.senderaddress,
								amount: "0",
								paymentId: contractData.paymentid
							}
									
							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;
							
								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'ADDMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token AddMeta Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else
							{
						
						
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'ADDMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}
						

								try 
								{
				
									implement(PyrkTransactionDetails)(TransactionDetails);

								} catch (e) {
				
									console.log(e);
									failed = true;
				
								}


								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: true,
									invalidReason: '',
									transactionDetails: TransactionDetails
								}
				
								try 
								{
				
									implement(PyrkTransactionObject)(TransactionObject);

								} catch (e) {
					
									console.log(e);
									failed = true;
				
								}
				
								console.log('-------------------------------------');
								console.log('Transaction Object');
								console.log(TransactionObject);
								console.log('-------------------------------------');
				
								if (failed === false)
								{
						
									// Sender //

									var srawRecordId = contractData.senderaddress + '.' + tokenId;
									var srecordId = SparkMD5.hash(srawRecordId);
						
									var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
									if (findSenderAddress == null)
									{

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'ADDMETA',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token AddMeta Failed - Sender Address Not Found',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										console.log('Error: Sender addresses not found');
							
										resolve(false);
						
									}
									else if (findSenderAddress.isMetaAuth == false)
									{

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'ADDMETA',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token AddMeta Failed - Sender Address Not Authorized',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										console.log('Error: Sender addresses not authorized');
							
										resolve(false);
						
									}
									else if (findToken.paused == true)
									{

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'ADDMETA',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token AddMeta Failed - Token is Paused',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										console.log('Error: Token is paused');
							
										resolve(false);
						
									}
									else
									{
						
										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);



										// Create New Record
									
										var MetaDetails = {
											schema_version: schemaVersion,
											posterAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											metaCode: metaCode,
											metaData: metaData
										}

										try 
										{
			
											implement(PyrkMetaDetails)(MetaDetails);

										} catch (e) {
			
											console.log(e);
										}

										var MetaObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											metaDetails: MetaDetails
										}

										try 
										{
			
											implement(PyrkMetaObject)(MetaObject);

										} catch (e) {
			
											console.log(e);
										}

										await qdb.insertDocument('metadata', MetaObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'metadata', {}, MetaObject);

						
										var newTokenMetas = await qdb.findDocumentCount('metadata', {"metaDetails.tokenIdHex": tokenId });

										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });


										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.block_last_active_meta": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_meta_since_genesis": newTokenMetas });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.block_last_active_meta": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_meta_since_genesis": newTokenMetas });


										resolve(true);
								
									}
										
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'ADDMETA',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}
									

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token AddMeta Failed - General Error',
										transactionDetails: TransactionDetails
									}

									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									resolve(false);
					
								}
						
							}

						}
						else if (contractData.transactiontype  == 'AUTHMETA')
						{
					
							// Authorize AddMeta to Address for Token

							var failed = false;

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.metaaddress,
								amount: "0",
								paymentId: contractData.paymentid
							}

							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'AUTHMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Address AuthMeta Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else if (findToken.tokenDetails.ownerAddress != contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'AUTHMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Address AuthMeta Failed - Not Owner',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('AuthMeta failed: Not the token owner');
						
								resolve(false);
						
							}
							else if (contractData.recipient == contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'AUTHMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Address AuthMeta Failed - Owner always authorized',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('AuthMeta failed: Owner always authorized');
						
								resolve(false);
						
							}
							else
							{
				
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var srawRecordId = contractData.senderaddress + '.' + tokenId;
								var srecordId = SparkMD5.hash(srawRecordId);
						
								var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
						
								if (findSenderAddress == null)
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'AUTHMETA',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Address AuthMeta Failed - Owner Address Not Found',
										transactionDetails: TransactionDetails
									}

									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: AuthMeta Sender address not found');
						
									resolve(false);
						
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'AUTHMETA',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}
								

									try 
									{
				
										implement(PyrkTransactionDetails)(TransactionDetails);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}


									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: true,
										invalidReason: '',
										transactionDetails: TransactionDetails
									}
				
									try 
									{
				
										implement(PyrkTransactionObject)(TransactionObject);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}
				
									//console.log('-------------------------------------');
									//console.log('Transaction Object');
									//console.log(TransactionObject);
									//console.log('-------------------------------------');
				
									var rrawRecordId = contractData.metaaddress + '.' + tokenId;
									var rrecordId = SparkMD5.hash(rrawRecordId);
						
									var findRecipientAddress = await qdb.findDocument('addresses', {"recordId": rrecordId});
				
									if (failed === false)
									{

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });


										if (findRecipientAddress == null)
										{
						
											// Create New Record
															
											var AddressObject = {
												schema_version: schemaVersion,
												recordId: rrecordId,
												address: contractData.metaaddress,
												tokenIdHex: tokenId,
												isOwner: false,
												isMetaAuth: true,
												lastUpdatedBlock: blockData.height
											}

											try 
											{
				
												implement(PyrkAddressObject)(AddressObject);

											} catch (e) {
				
												console.log(e);
				
											}
							

											await qdb.insertDocument('addresses', AddressObject);

											await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'addresses', {}, AddressObject);

															
										}
										else
										{
									
											// Set MetaAuth Active

											await qdb.updateDocument('addresses', {"recordId": rrecordId }, {"isMetaAuth": true, "lastUpdatedBlock": blockData.height });

											await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": rrecordId }, {"isMetaAuth": true, "lastUpdatedBlock": blockData.height });

										}

										var newTokenAddrs = await qdb.findDocumentCount('addresses', {"tokenIdHex": tokenId });
																			
										var newAuthMetaAddrs = await qdb.findDocumentCount('addresses', { $and: [ { "tokenIdHex": tokenId }, { "isAuthMeta": true } ] });

						

										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_token_addresses": newTokenAddrs, "tokenStats.qty_valid_metaauth_addresses": newAuthMetaAddrs });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_token_addresses": newTokenAddrs, "tokenStats.qty_valid_metaauth_addresses": newAuthMetaAddrs });


										resolve(true);
										
									}
									else
									{

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'AUTHMETA',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Address AuthMeta Failed - General Error',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
					
									}
						
								}
						
							}

						}
						else if (contractData.transactiontype  == 'REVOKEMETA')
						{
					
							// Revoke meta access

							var failed = false;

							var tokenId = contractData.tokenid;

							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.metaaddress,
								amount: "0",
								paymentId: contractData.paymentid
							}
						
							var findToken = await qdb.findDocument('tokens', { $and: [ { "tokenDetails.tokenIdHex": tokenId }, { "type": "TYPE1" } ] });

							// Check if it actually exists
						
							if (findToken == null)
							{

								var tSymbol = null;
								var tName = null;
					
								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'REVOKEMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Address RevokeMeta Failed - Token Does Not Exist',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('Token does not exist');
						
								resolve(false);
						
							}
							else if (findToken.tokenDetails.ownerAddress != contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;
					
								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'REVOKEMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Address RevokeMeta Failed - Not Owner',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('RemoveMeta failed: Not the token owner');
						
								resolve(false);
						
							}
							else if (contractData.recipient == contractData.senderaddress)
							{

								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var TransactionDetails = {
									schema_version: schemaVersion,
									transactionType: 'REVOKEMETA',
									senderAddress: contractData.senderaddress,
									tokenIdHex: tokenId,
									versionType: 1,
									timestamp: (new Date(transactionData.time * 1000)).toJSON(),
									timestamp_unix: transactionData.time,
									symbol: tSymbol,
									name: tName,
									genesisOrBurnQuantity: "0",
									sendOutput: TransactionOutput,
									fee_paid: Big(contractData.feepaid).toFixed(8)
								}

								var TransactionObject = {
									schema_version: schemaVersion,
									txid: transactionData.txid,
									blockId: blockData.hash,
									blockHeight: blockData.height,
									valid: false,
									invalidReason: 'Token Address RevokeMeta Failed - Owner always authorized',
									transactionDetails: TransactionDetails
								}

								await qdb.insertDocument('transactions', TransactionObject);

								await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


								console.log('RevokeMeta failed: Owner always authorized');
						
								resolve(false);
						
							}
							else
							{
				
								var tSymbol = findToken.tokenDetails.symbol;
								var tName = findToken.tokenDetails.name;

								var srawRecordId = contractData.senderaddress + '.' + tokenId;
								var srecordId = SparkMD5.hash(srawRecordId);
						
								var findSenderAddress = await qdb.findDocument('addresses', {"recordId": srecordId});
						
								if (findSenderAddress == null)
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'REVOKEMETA',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}
							
									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: false,
										invalidReason: 'Token Address RevokeMeta Failed - Owner Address Not Found',
										transactionDetails: TransactionDetails
									}

									await qdb.insertDocument('transactions', TransactionObject);

									await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


									console.log('Error: Sender address not found');
						
									resolve(false);
						
								}
								else
								{

									var TransactionDetails = {
										schema_version: schemaVersion,
										transactionType: 'REVOKEMETA',
										senderAddress: contractData.senderaddress,
										tokenIdHex: tokenId,
										versionType: 1,
										timestamp: (new Date(transactionData.time * 1000)).toJSON(),
										timestamp_unix: transactionData.time,
										symbol: tSymbol,
										name: tName,
										genesisOrBurnQuantity: "0",
										sendOutput: TransactionOutput,
										fee_paid: Big(contractData.feepaid).toFixed(8)
									}

									try 
									{
				
										implement(PyrkTransactionDetails)(TransactionDetails);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}


									var TransactionObject = {
										schema_version: schemaVersion,
										txid: transactionData.txid,
										blockId: blockData.hash,
										blockHeight: blockData.height,
										valid: true,
										invalidReason: '',
										transactionDetails: TransactionDetails
									}
				
									try 
									{
				
										implement(PyrkTransactionObject)(TransactionObject);

									} catch (e) {
				
										console.log(e);
										failed = true;
				
									}
				
									//console.log('-------------------------------------');
									//console.log('Transaction Object');
									//console.log(TransactionObject);
									//console.log('-------------------------------------');
				
									var rrawRecordId = contractData.metaaddress + '.' + tokenId;
									var rrecordId = SparkMD5.hash(rrawRecordId);
						
									var findRecipientAddress = await qdb.findDocument('addresses', {"recordId": rrecordId});
				
									if (failed === false && findRecipientAddress !== null)
									{

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										var newValidTxns = await qdb.findDocumentCount('transactions', {"transactionDetails.tokenIdHex": tokenId, "valid": true });

										// Set Address 

										await qdb.updateDocument('addresses', {"recordId": rrecordId }, {"isMetaAuth": false, "lastUpdatedBlock": blockData.height });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'addresses', {"recordId": rrecordId }, {"isMetaAuth": false, "lastUpdatedBlock": blockData.height });


									
										var newAuthMetaAddrs = await qdb.findDocumentCount('addresses', { $and: [ { "tokenIdHex": tokenId }, { "isAuthMeta": true } ] });


										await qdb.updateDocument('tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_metaauth_addresses": newAuthMetaAddrs });

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'update', 'tokens', {"tokenDetails.tokenIdHex": tokenId }, {"lastUpdatedBlock": blockData.height, "tokenStats.qty_valid_txns_since_genesis": newValidTxns, "tokenStats.qty_valid_metaauth_addresses": newAuthMetaAddrs });


										resolve(true);
										
									}
									else if (findRecipientAddress == null)
									{
								
										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'REVOKEMETA',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Address RevokeMeta Failed - Recipient Not Found',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
								
									}
									else
									{

										var TransactionDetails = {
											schema_version: schemaVersion,
											transactionType: 'REVOKEMETA',
											senderAddress: contractData.senderaddress,
											tokenIdHex: tokenId,
											versionType: 1,
											timestamp: (new Date(transactionData.time * 1000)).toJSON(),
											timestamp_unix: transactionData.time,
											symbol: tSymbol,
											name: tName,
											genesisOrBurnQuantity: "0",
											sendOutput: TransactionOutput,
											fee_paid: Big(contractData.feepaid).toFixed(8)
										}

										var TransactionObject = {
											schema_version: schemaVersion,
											txid: transactionData.txid,
											blockId: blockData.hash,
											blockHeight: blockData.height,
											valid: false,
											invalidReason: 'Token Address RevokeMeta Failed - General Error',
											transactionDetails: TransactionDetails
										}

										await qdb.insertDocument('transactions', TransactionObject);

										await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


										resolve(false);
					
									}
						
								}
						
							}

						}
						else
						{
		
							var TransactionOutput = {
								schema_version: schemaVersion,
								address: contractData.metaaddress,
								amount: "0",
								paymentId: contractData.paymentid
							}

							var TransactionDetails = {
								schema_version: schemaVersion,
								transactionType: 'ERROR',
								senderAddress: contractData.senderaddress,
								tokenIdHex: '',
								versionType: 1,
								timestamp: (new Date(transactionData.time * 1000)).toJSON(),
								timestamp_unix: transactionData.time,
								symbol: '',
								name: '',
								genesisOrBurnQuantity: "0",
								sendOutput: TransactionOutput,
								fee_paid: Big(contractData.feepaid).toFixed(8)
							}

							var TransactionObject = {
								schema_version: schemaVersion,
								txid: transactionData.txid,
								blockId: blockData.hash,
								blockHeight: blockData.height,
								valid: false,
								invalidReason: 'Invalid Command',
								transactionDetails: TransactionDetails
							}


							await qdb.insertDocument('transactions', TransactionObject);

							await qdb.createJournalEntry(transactionData.txid, blockData.hash, blockData.height, (new Date(transactionData.time * 1000)).toJSON(), transactionData.time, 'insert', 'transactions', {}, TransactionObject);


							// Invalid command
							console.log("Invalid Command");
				
							resolve(false); 

						}
				
					}

				}
			
			})();
			
		});
	
	};

	pyrkSchema.prototype.indexDatabase = function (qdb)
	{
		
		return new Promise((resolve, reject) => {

			(async () => {

				var mclient = await qdb.connect();
				qdb.setClient(mclient);
				
				/* Tokens */
				response = await qdb.createIndex('tokens', {"tokenDetails.tokenIdHex": 1}, true);
				response = await qdb.createIndex('tokens', {"tokenDetails.symbol": 1}, false);
				response = await qdb.createIndex('tokens', {"tokenDetails.name": 1}, false);
				response = await qdb.createIndex('tokens', {"tokenDetails.ownerAddress": 1}, false);
				response = await qdb.createIndex('tokens', {"tokenStats.creation_transaction_id": 1}, false);
				response = await qdb.createIndex('tokens', {"type": 1}, false);
				response = await qdb.createIndex('tokens', {"lastUpdatedBlock": 1}, false);

				/* Addresses */
				response = await qdb.createIndex('addresses', {"recordId": 1}, true);
				response = await qdb.createIndex('addresses', {"address": 1}, false);
				response = await qdb.createIndex('addresses', {"tokenIdHex": 1}, false);
				response = await qdb.createIndex('addresses', {"isOwner": 1}, false);
				response = await qdb.createIndex('addresses', {"isMetaAuth": 1}, false);
				response = await qdb.createIndex('addresses', {"lastUpdatedBlock": 1}, false);
			
				/* Transactions */
				response = await qdb.createIndex('transactions', {"txid": 1}, true);
				response = await qdb.createIndex('transactions', {"blockId": 1}, false);
				response = await qdb.createIndex('transactions', {"blockHeight": 1}, false);
				response = await qdb.createIndex('transactions', {"transactionDetails.senderAddress": 1}, false);
				response = await qdb.createIndex('transactions', {"transactionDetails.tokenIdHex": 1}, false);
				response = await qdb.createIndex('transactions', {"transactionDetails.timestamp_unix": 1}, false);
				response = await qdb.createIndex('transactions', {"transactionDetails.transactionType": 1}, false);
				response = await qdb.createIndex('transactions', {"transactionDetails.sendOutput.address": 1}, false);

				/* Meta */
				response = await qdb.createIndex('metadata', {"txid": 1}, true);
				response = await qdb.createIndex('metadata', {"blockId": 1}, false);
				response = await qdb.createIndex('metadata', {"blockHeight": 1}, false);
				response = await qdb.createIndex('metadata', {"metaDetails.posterAddress": 1}, false);
				response = await qdb.createIndex('metadata', {"metaDetails.tokenIdHex": 1}, false);
				response = await qdb.createIndex('metadata', {"metaDetails.timestamp_unix": 1}, false);
				response = await qdb.createIndex('metadata', {"metaDetails.metaCode": 1}, false);

/* Journal Format 

{
	_id: autoincrement,
	txid: ...,
	blockId: ...,
	blockHeight: ...,
	timestamp: ...,
	timestamp_unix: ...,
	action: (insert, update, delete),
	fieldData: (if update or delete),
	recordData:  ...,  
	recordHash: ...,  md5(action . jsonencode(fielddata) . jsonencode(actiondata))
	chainHash: ...	md5(previousrecordhash . thisrecordhash)

}

*/
				/* Journal Log */
				response = await qdb.createIndex('journal', {"txid": 1}, false);
				response = await qdb.createIndex('journal', {"blockId": 1}, false);
				response = await qdb.createIndex('journal', {"blockHeight": 1}, false);
				response = await qdb.createIndex('journal', {"recordHash": 1}, false);
				response = await qdb.createIndex('journal', {"chainHash": 1}, false);

				await qdb.close();
			
				resolve(true);

			})();

		});
	
	};

	return pyrkSchema;

}());

exports.default = pyrkSchema;
