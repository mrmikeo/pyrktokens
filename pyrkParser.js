/*
*
* Pyrk Tokens - Version 1.1.1
*
*
* A simplified token management system for the Pyrk network
*
* pyrkParser - Parse the blockchain for Token items
*
*/

const redis		  = require('redis');			 // a really fast nosql keystore
const fs		  = require('fs');				 // so we can read the config ini file from disk
const ini		  = require('ini');				 // so we can parse the ini files properties
const Big		  = require('big.js');			 // required unless you want floating point math issues
const nodemailer  = require('nodemailer');		 // for sending error reports about this node
const crypto	  = require('crypto');			 // for creating hashes of things
const SparkMD5	  = require('spark-md5');  		 // Faster than crypto for md5
const {promisify} = require('util');			 // Promise functions
const asyncv3	  = require('async');			 // Async Helper

const pyrkcore 	  = require('@pyrkcommunity/pyrkcore-lib'); // Pyrk core library for nodejs

const Client	  = require('bitcoin-core');	 // Bitcoin RPC

const { onShutdown } = require('node-graceful-shutdown');

var shuttingdown = false;
var safetoshutdown = false;

// On Shutdown - Do some Cleanup
onShutdown("parser", async function () {

	shuttingdown = true;

	return new Promise((resolve, reject) => {
    
		var shutdowncheck = setInterval(function() {

			console.log('Checking if shutdown is safe... ' + safetoshutdown.toString());
			//if (safetoshutdown == true)
			//{
				resolve(true);
			//}
  
		}, 1000);

	});
	
});

var iniconfig = ini.parse(fs.readFileSync('/etc/pyrk/pyrk.ini', 'utf-8'))

// Pyrk RPC

var client = new Client({ host: iniconfig.pyrk_host, port: iniconfig.pyrk_port, username: iniconfig.pyrk_username, password: iniconfig.pyrk_password });

// Mongo Connection Details
const mongoconnecturl = iniconfig.mongo_connection_string;
const mongodatabase = iniconfig.mongo_database;

// MongoDB Library
const pyrkDB = require("./lib/pyrkDB");
const qdb = new pyrkDB.default(mongoconnecturl, mongodatabase);

// Connect to Redis and setup some async call definitions
const rclient	 = redis.createClient(iniconfig.redis_port, iniconfig.redis_host,{detect_buffers: true});
const rclienttwo = redis.createClient(iniconfig.redis_port, iniconfig.redis_host,{detect_buffers: true});
const hgetAsync  = promisify(rclient.hget).bind(rclient);
const hsetAsync  = promisify(rclient.hset).bind(rclient);
const getAsync	 = promisify(rclient.get).bind(rclient);
const setAsync	 = promisify(rclient.set).bind(rclient);
const delAsync	 = promisify(rclient.del).bind(rclient);

// QAE-1 Token Schema
const pyrkSchema = require("./lib/pyrkSchema");
const pyrk = new pyrkSchema.default();

const activationHeight = 28000;
const activationBlockId = '4cb9ca8f26d1e29ff050026309f1f1b7972a83104362aeedc0923296358bd5c7';

const validopcodes = ['01','02','03','04','05','06','07','08','09'];

// Declaring some variable defaults

var scanBlockId = 0;
var lastBlockId = '';
var sigblockhash = '';
var sigtokenhash = '';
var sigaddrhash = '';
var sigtrxhash = '';
var previoushash = '';
var fullhash = '';
var processedItems = false;
var lastBlockNotify = Math.floor(new Date() / 1000);

var scanLock = false;
var scanLockTimer = 0;

// Let us know when we connect or have an error with redis
rclient.on('connect', function() {
	console.log('Connected to Redis');
});

rclient.on('error',function() {
	console.log("Error in Redis");
	error_handle("Error in Redis", 'redisConnection');
});

// Rescan Flag or Unknown last scan -  rescans all transaction (ie. #node qaeApiv2.js true)

rclient.del('blockNotify');

rclient.get('pyrk_lastscanblock', function(err, lbreply)
{

	if ((process.argv.length == 3 && (process.argv[2] == '1' || process.argv[2] == 'true')) || lbreply == null || parseInt(lbreply) != lbreply) 
	{

		(async () => {
		
			console.log("--------------------");
			console.log("Forcing a Rescan....");
			console.log("--------------------");

			await delAsync('pyrk_lastscanblock');
			await delAsync('pyrk_lastblockid');
		
			await setAsync('pyrk_lastscanblock', activationHeight);
			await setAsync('pyrk_lastblockid', activationBlockId);

								
			// Remove items from MongoDB
			
			let response = {};
			let exists = true;
				
			var mclient = await qdb.connect();
			qdb.setClient(mclient);
				
			exists = await qdb.doesCollectionExist('tokens');
			console.log("Does collection 'tokens' Exist: " + exists);
			if (exists == true)
			{
				console.log("Removing all documents from 'tokens'");
				await qdb.removeDocuments('tokens', {});
			}
			else
			{
				console.log("Creating new collection 'tokens'");
				await qdb.createCollection('tokens', {});
			}

			exists = await qdb.doesCollectionExist('addresses');
			console.log("Does collection 'addresses' Exist: " + exists);
			if (exists == true)
			{
				console.log("Removing all documents from 'addresses'");
				await qdb.removeDocuments('addresses', {});
			}
			else
			{
				console.log("Creating new collection 'addresses'");
				await qdb.createCollection('addresses', {});
			}
				
			exists = await qdb.doesCollectionExist('transactions');
			console.log("Does collection 'transactions' Exist: " + exists);
			if (exists == true)
			{
				console.log("Removing all documents from 'transactions'");
				await qdb.removeDocuments('transactions', {});
			}
			else
			{
				console.log("Creating new collection 'transactions'");
				await qdb.createCollection('transactions', {});
			}

			exists = await qdb.doesCollectionExist('journal');
			console.log("Does collection 'journal' Exist: " + exists);
			if (exists == true)
			{
				console.log("Removing all documents from 'journal'");
				await qdb.removeDocuments('journal', {});
			}
			else
			{
				console.log("Creating new collection 'journal'");
				await qdb.createCollection('journal', {});
			}

			exists = await qdb.doesCollectionExist('metadata');
			console.log("Does collection 'metadata' Exist: " + exists);
			if (exists == true)
			{
				console.log("Removing all documents from 'metadata'");
				await qdb.removeDocuments('metadata', {});
			}
			else
			{
				console.log("Creating new collection 'metadata'");
				await qdb.createCollection('metadata', {});
			}

			exists = await qdb.doesCollectionExist('counters');
			console.log("Does collection 'counters' Exist: " + exists);
			if (exists == true)
			{
				console.log("Removing all documents from 'counters'");
				await qdb.removeDocuments('counters', {});
			}
			
			await pyrk.indexDatabase(qdb);
			
			await qdb.close();	
			
			// Initialze things
			initialize();
			
		})();
		
	}
	else
	{
		// Initialze things
		initialize(); 
	}	
	
});


// Main Functions
// ==========================

function initialize()
{

	getChainInfo();
	blockNotifyQueue();

}

function blockNotifyQueue() 
{
  		
	rclienttwo.blpop('blockNotify', iniconfig.polling_interval, function(err, data)
	{

		if (data && data[1] == 'new')
		{
			console.log("new block notify via rqueue");
			newblocknotify();
		}
		else
		{
			var currentIntervalTime = Math.floor(new Date() / 1000);
			if (lastBlockNotify < (currentIntervalTime - iniconfig.polling_interval))
			{
				console.log("new block notify via timeout");
				newblocknotify();
			}
		}
		
		blockNotifyQueue();
	
	});
	
}

function getChainInfo()
{

	client.command('getblockchaininfo').then((info) => {
	
		console.log(info);

		var topHeight = info.blocks;
		lastBlockId = info.bestblockhash;
		
		console.log('Pyrk Current Top Height #' + topHeight + '.....');

		scanLock = false;
		scanLockTimer = 0;

		doScan();
	
	}).catch((err) => {
	
		console.log(err);
	
	});

}

function syncJournalFromPeer()
{





}

function rebuildDbFromJournal()
{





}

function doScan()
{

	if (scanLock == false)
	{

		scanLock = true;
		scanLockTimer = Math.floor(new Date() / 1000);
	
		rclient.get('pyrk_lastscanblock', function(err, reply){

	console.log(reply);

			if (err)
			{
				console.log(err);
			}
			else if (reply == null || parseInt(reply) != reply)
			{
				scanBlockId = activationHeight;
			}
			else
			{
				scanBlockId = parseInt(reply);
			}
		
			//
		
			rclient.get('pyrk_lastblockid', function(err, replytwo){

				if (err)
				{
					console.log(err);
				}
				else if (reply == null)
				{
					lastBlockId = activationBlockId;
				}
				else
				{
					lastBlockId = replytwo;
				}
		
		
				//

				var currentHeight = 0;

				client.command('getblockchaininfo').then((info) => {

					(async () => {
				
						console.log(info);

						currentHeight = info.blocks;
				
						var mclient = await qdb.connect();
						qdb.setClient(mclient);
			
						console.log('Scanning from block #' + scanBlockId + ' to Current Height: ' + currentHeight);
			
						await whilstScanBlocks(scanBlockId, currentHeight, qdb);
					
						console.log('Scan completed');
					
						await qdb.close();
				
					})();

				}).catch((err) => {

					console.log(err);

				});
									

			});
	
		});
	
	}

}


async function whilstScanBlocks(count, max, qdb)
{

	return new Promise((resolve) => {

		asyncv3.whilst(
			function test(cb) { cb(null, count < max) },
			function iter(callback) {

				(async () => {
				
					if (shuttingdown == true)
					{
				
						safetoshutdown = true;
				
					}
					else
					{

						count++;
						
						console.log(count);
			
						scanLockTimer = Math.floor(new Date() / 1000);
										
						if (count%1000 == 0 || count == max) console.log("Scanning: " + count);
				

						var blockhash = await client.getBlockHash(count);
					
						var blockdata = await client.getBlock(blockhash);

						if (blockdata && blockdata.hash)
						{

							var blockidcode = blockdata.hash;
							var blocktranscount = blockdata.tx.length;
							var thisblockheight = blockdata.height;

							var previousblockid = blockdata.previousblockhash;

							if (lastBlockId != previousblockid && thisblockheight > activationHeight)
							{
				
								console.log('Error:	 Last Block ID is incorrect!  Rescan Required!');
						
								console.log("Expected: " + previousblockid);
								console.log("Received: " + lastBlockId);
								console.log("ThisBlockHeight: " + thisblockheight);
								console.log("LastScanBlock: " + count);
								console.log(blockdata);
								
								rclient.del('pyrk_lastblockid', function(err, reply){
									rclient.del('pyrk_lastscanblock', function(err, reply){
										process.exit(-1);
									});
								});
				
							}

							lastBlockId = blockidcode;
						
							processedItems = false;

							if (blocktranscount > 0 && thisblockheight >= activationHeight)
							{
								
								for (let ti = 0; ti < blocktranscount; ti++)
								{

									var txdetails = await client.getRawTransaction(blockdata.tx[ti], true);
												
												
									if (txdetails['vin'][0]['txid'])
									{
									
										var inputtxdetails = await client.getRawTransaction(txdetails['vin'][0]['txid'], true);		
									
										
										try {
									
											var inputvalue = Big(inputtxdetails['vout'][txdetails['vin'][0]['vout']]['value']);
												
											var totalout = Big(0);		
											for (let si = 0; si < txdetails.vout.length; si++)
											{
												var vitem = txdetails.vout[si];
												totalout = Big(totalout).plus(vitem.value);
											}
											var feespaid = Big(inputvalue).minus(totalout);
									
										} catch (e) {
									
											var feespaid = Big(0);
										
										}
									
									}
									else
									{
										var feespaid = Big(0);
									}
									
									
									var senderaddress = '';
									
									if (txdetails['vin'][0]['scriptSig'])
									{
																			
										var vinasm = txdetails['vin'][0]['scriptSig']['asm'].split(' ');
										senderaddress = pyrkcore.PublicKey(vinasm[1]).toAddress().toString();

									}
								
									for (let si = 0; si < txdetails.vout.length; si++)
									{
									
										var vitem = txdetails.vout[si];
																							
										if (vitem['scriptPubKey'] && vitem['scriptPubKey']['asm'])
										{
										
											var asm = vitem['scriptPubKey']['asm'];

											if (asm.indexOf('OP_RETURN') != -1)
											{
										
												var opreturndata = asm.substr(10);
												
												//console.log(opreturndata.substr(0,4));
											
												if (opreturndata.substr(0,4) == '3432') // This is the code for Tokens
												{
											
													// See what the opcode is
													var protocolid = opreturndata.substr(0,4);
													var versionnum = opreturndata.substr(4,2);
													var opcode = opreturndata.substr(6,2);
													
													if (versionnum == '01' && validopcodes.indexOf(opcode) != -1) // ok continue
													{
														switch (opcode) {
														
															case '01':
															
																/***
																*
																*    Issue New Token
																*
																*/
																
																//console.log(opreturndata);
																
																try {
																
																	var rawtickercode = opreturndata.substr(8,10);
																	var rawtokenname = opreturndata.substr(18,40);
																	var rawvaluesat = opreturndata.substr(58,16);
																	var rawvalueduri = opreturndata.substr(74,70);
																	var rawvalueluri = opreturndata.substr(144);

console.log("rInt:" + rawvaluesat);
																	
																	var tickercode = Buffer.from(rawtickercode, 'hex').toString('utf8').replace(/\0/g, '').trim();
																	var tokenname = Buffer.from(rawtokenname, 'hex').toString('utf8').replace(/\0/g, '').trim();

																	var valuesat = String(parseInt(rawvaluesat, 16));
																	

console.log(valuesat);
																	var valueduri = Buffer.from(rawvalueduri, 'hex').toString('utf8').replace(/\0/g, '').trim();
																	var valueluri = Buffer.from(rawvalueluri, 'hex').toString('utf8').replace(/\0/g, '').trim();


																	//console.log("Ticker:" + tickercode);
																	//console.log("Name:" + tokenname);
																	//console.log("sat:" + valuesat);
																	
																	var realvalue = Big(valuesat).div(100000000).toFixed(8);
																
																	if (tickercode != '' && tokenname != '' && Big(realvalue).gte(0))
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'GENESIS',
																				tickercode: tickercode,
																				tokenname: tokenname,
																				valuesat: valuesat,
																				realvalue: realvalue,
																				documenturi: valueduri,
																				logouri: valueluri,
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};

//console.log(createobject);

																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	//console.log(txdetails);
																	//console.log(blockdata);
																	//console.log(txdetails['vin']);
																	//console.log(txdetails['vout']);
																	
																	// These 3 items send for processing...

																	
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																	
																}
																
																break;
																
															case '02':
															
																/***
																*
																*    Add Meta Data
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawmetacode = opreturndata.substr(8,8);
																	var rawtokenid = opreturndata.substr(16,22);
																	var rawmetavalue = opreturndata.substr(38);
																	
																	var metacode = parseInt(rawmetacode, 16);
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');
																	var metavalue = Buffer.from(rawmetavalue, 'hex').toString('utf8').replace(/\0/g, '').trim();
																	
																	console.log("Metacode:" + metacode);
																	console.log("TokenID:" + tokenid);
																	console.log("MetaValue:" + metavalue);

																
																	if (tokenid != '')
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'ADDMETA',
																				tokenid: tokenid,
																				metacode: metacode,
																				metavalue: metavalue,
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																	
																}
															
																break;
														
															case '03':

																/***
																*
																*    Burn Token
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
																	var rawvaluesat = opreturndata.substr(30,16);
																	
															
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');

																	var valuesat = String(parseInt(rawvaluesat, 16));
																	
																	//console.log("tokenid:" + tokenid);
																	//console.log("valuesat:" + valuesat);
																	
																	var realvalue = Big(stringvalue).div(100000000).toFixed(8);
																
																	if (tokenid != '' && Big(realvalue).gt(0))
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'BURN',
																				tokenid: tokenid,
																				valuesat: valuesat,
																				realvalue: realvalue,
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;
														
															case '04':
															
																/***
																*
																*    Send Token
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
																	var rawvalueint = opreturndata.substr(30,16);
																	var rawrecipient = opreturndata.substr(46,68);
																	var rawpaymentid = opreturndata.substr(114);

																	var tokenid = rawtokenid; //Buffer.from(rawtokenid, 'hex').toString();

																	var valuesat = String(parseInt(rawvalueint, 16));
																	
																	var recipient = Buffer.from(rawrecipient, 'hex').toString('utf8').replace(/\0/g, '').trim();
																	var paymentid = Buffer.from(rawpaymentid, 'hex').toString('utf8').replace(/\0/g, '').trim();

																	console.log("tokenid:" + tokenid);
																	console.log("valuesat:" + valuesat);
																	console.log("recipient:" + recipient);
																	console.log("paymentid:" + paymentid);

																	
																	
																	var realvalue = Big(valuesat).div(100000000).toFixed(8);
																
																	if (tokenid != '' && Big(realvalue).gt(0))
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'SEND',
																				tokenid: tokenid,
																				valuesat: valuesat,
																				realvalue: realvalue,
																				recipient: recipient,
																				paymentid: paymentid,
																				feepaid: feespaid.toFixed(8)
																			};

console.log(createobject);

																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;

															case '05':
															
																/***
																*
																*    Pause Token
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
															
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');

																	//console.log("tokenid:" + tokenid);
																
																	if (tokenid != '')
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'PAUSE',
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;

															case '06':
															
																/***
																*
																*    Resume Token
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
															
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');

																	//console.log("tokenid:" + tokenid);
																
																	if (tokenid != '')
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'RESUME',
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;

															case '07':
															
																/***
																*
																*    New Owner
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
																	var rawnewowner = opreturndata.substr(30,68);
															
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');
																	var newowner = Buffer.from(rawnewowner, 'hex').toString('utf8').replace(/\0/g, '').trim();

																	//console.log("tokenid:" + tokenid);
																	//console.log("newowner:" + newowner);
																
																	if (tokenid != '' && newowner != '')
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'NEWOWNER',
																				tokenid: tokenid,
																				newowner: newowner,
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;

															case '08':
															
																/***
																*
																*    Auth Meta
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
																	var rawmetaaddress = opreturndata.substr(30,68);
															
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');
																	var metaaddress = Buffer.from(rawmetaaddress, 'hex').toString('utf8').replace(/\0/g, '').trim();

																	//console.log("tokenid:" + tokenid);
																	//console.log("newowner:" + newowner);
																
																	if (tokenid != '' && metaaddress != '')
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'AUTHMETA',
																				tokenid: tokenid,
																				metaaddress: metaaddress,
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;

															case '08':
															
																/***
																*
																*    Revoke Meta
																*
																*/
																
																console.log(opreturndata);
																
																try {
																
																	var rawtokenid = opreturndata.substr(8,22);
																	var rawmetaaddress = opreturndata.substr(30,68);
															
																	var tokenid = Buffer.from(rawtokenid, 'hex').toString('hex');
																	var metaaddress = Buffer.from(rawmetaaddress, 'hex').toString('utf8').replace(/\0/g, '').trim();

																	//console.log("tokenid:" + tokenid);
																	//console.log("newowner:" + newowner);
																
																	if (tokenid != '' && metaaddress != '')
																	{
																
																		var createobject = {
																				protocolid: protocolid,
																				versionnum: versionnum,
																				opcode: opcode,
																				senderaddress: senderaddress,
																				transactiontype: 'REVOKEMETA',
																				tokenid: tokenid,
																				metaaddress: metaaddress,
																				paymentid: '',
																				feepaid: feespaid.toFixed(8)
																			};
																		
																	}
																	else
																	{
																	
																		var createobject = null;
																	
																	}
																	
																	
																} catch (e) {

																	//console.log(e);
																	
																	var createobject = null;
																
																}
																
																if (createobject != null)
																{
																
																	console.log(createobject);
																	console.log(txdetails);
																	console.log(blockdata);
																	
																	// These 3 items send for processing...
																																		
																	var pyrkresult = await pyrk.parseTransaction(txdetails, blockdata, createobject, qdb);
																																																			
																}
															
																break;


														}
														
													}
													
												}
											
											}
										
										}
									
									}
								
								}

								rclient.set('pyrk_lastblockid', blockidcode, function(err, reply){
									rclient.set('pyrk_lastscanblock', thisblockheight, function(err, reply){
										callback(null, count);
									});
								});


								
							}
							else
							{

								rclient.set('pyrk_lastblockid', blockidcode, function(err, reply){
									rclient.set('pyrk_lastscanblock', thisblockheight, function(err, reply){
										callback(null, count);
									});
								});
							
							}


						}
						else
						{
				
							console.log("Block #" + count + " not found.. This is a fatal error...");
							process.exit(-1);
				
						}
							
					
					
					}
				
				})();
									
			},
			function(err, n) {
		
				scanLock = false;
				scanLockTimer = 0;
			
				resolve(true);

			}
		
		);

	});

}

function newblocknotify()
{

	lastBlockNotify = Math.floor(new Date() / 1000);
	
	console.log('New Block Notify..');

	if (scanLock == true)
	{
		// TODO:  Check if it is a stale lock
		var currentUnixTime = Math.floor(new Date() / 1000);
		if (scanLockTimer < (currentUnixTime - iniconfig.scanlock_staletime))
		{
			// force unlock
			console.log("Forcing scanlock Unlock....");
			scanLock = false;
		}
	
	
		console.log('Scanner already running...');
	}
	else
	{
		doScan();
	}
	
	return true;

}





// Helpers
// ==========================


function hex_to_ascii(str1)
{
	var hex	 = str1.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
}

function decimalPlaces(num) 
{
  var match = (Big(num).toString()).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) { return 0; }
  return Math.max(
	   0,
	   // Number of digits right of decimal point.
	   (match[1] ? match[1].length : 0)
	   // Adjust for scientific notation.
	   - (match[2] ? +match[2] : 0));
}

function truncateToDecimals(num, dec = 2) 
{
  const calcDec = Math.pow(10, dec);
  
  var bignum = new Big(num);
  var multiplied = parseInt(bignum.times(calcDec));
  var newbig = new Big(multiplied);
  var returnval = newbig.div(calcDec);

  return returnval.toFixed(dec);
}

function error_handle(error, caller = 'unknown', severity = 'error')
{

	var scriptname = 'pyrkParser.js';

	console.log("Error Handle has been called!");
	
	console.log(error);

	let transporter = nodemailer.createTransport({
		sendmail: true,
		newline: 'unix',
		path: '/usr/sbin/sendmail'
	});
	transporter.sendMail({
		from: iniconfig.error_from_email,
		to: iniconfig.error_to_email,
		subject: 'OhNo! Error in ' + scriptname + ' at ' + caller,
		text: 'OhNo! Error in ' + scriptname + ' at ' + caller + '\n\n' + JSON.stringify(error)
	}, (err, info) => {
		console.log(err);
		console.log(info);
	});

}
	
