/*
*
* Pyrk Tokens - Version 1.1.1
*
*
* A simplified token management system for the Pyrk network
*
* pyrkApi - API Interface for Pyrk Tokens
*
*/

const express	  = require('express');			 // call express
const app		  = express();					 // define our app using express
const bodyParser  = require('body-parser');		 // for post calls
const cors		  = require('cors');			 // Cross Origin stuff
const redis		  = require('redis');			 // a really fast nosql keystore
const fs		  = require('fs');				 // so we can read the config ini file from disk
const ini		  = require('ini');				 // so we can parse the ini files properties
const Big		  = require('big.js');			 // required unless you want floating point math issues
const nodemailer  = require('nodemailer');		 // for sending error reports about this node
const crypto	  = require('crypto');			 // for creating hashes of things
const SparkMD5	  = require('spark-md5');  		 // Faster than crypto for md5
const request	  = require('request');			 // Library for making http requests
const publicIp	  = require('public-ip');		 // a helper to find out what our external IP is.	Needed for generating proper ring signatures
const {promisify} = require('util');			 // Promise functions
const asyncv3	  = require('async');			 // Async Helper
const zmq 		  = require("zeromq");		     // For new block notifications
const pyrkcore 	  = require('@pyrkcommunity/pyrkcore-lib'); // Pyrk core library for nodejs
const Client	  = require('bitcoin-core');	 // Bitcoin RPC
const path 		  = require('path');

var iniconfig = ini.parse(fs.readFileSync('/etc/pyrk/pyrk.ini', 'utf-8'))

// Pyrk RPC
var client = new Client({ host: iniconfig.pyrk_host, port: iniconfig.pyrk_port, username: iniconfig.pyrk_username, password: iniconfig.pyrk_password });

// Mongo Connection Details
const mongoconnecturl = iniconfig.mongo_connection_string;
const mongodatabase = iniconfig.mongo_database;

// MongoDB Library
const pyrkDB = require("./lib/pyrkDB");

// Connect to Redis and setup some async call definitions
const rclient	= redis.createClient(iniconfig.redis_port, iniconfig.redis_host,{detect_buffers: true});
const hgetAsync = promisify(rclient.hget).bind(rclient);
const hgetAllAsync = promisify(rclient.hgetall).bind(rclient);
const hsetAsync = promisify(rclient.hset).bind(rclient);
const getAsync	= promisify(rclient.get).bind(rclient);
const setAsync	= promisify(rclient.set).bind(rclient);
const delAsync	= promisify(rclient.del).bind(rclient);


// Declaring some variable defaults
var myIPAddress = '';
var goodPeers = {};
var badPeers = {};
var unvalidatedPeers = {};
var gotSeedPeers = 0;
var lastBlockNotify = Math.floor(new Date() / 1000);

// Generate Random Keys for Webhooks
var webhookToken = '';
var webhookVerification = '';

// Trusted seed node
var seedNode = iniconfig.seed_node;

// Let us know when we connect or have an error with redis
rclient.on('connect', function() {
	console.log('Connected to Redis');
});

rclient.on('error',function() {
	console.log("Error in Redis");
	error_handle("Error in Redis", 'redisConnection');
});

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');
app.use(express.static(path.join(__dirname, 'public')));


var port = iniconfig.api_port;

// We will keep in memory the ips that connect to us
var accessstats = [];

// ROUTES FOR OUR API
// =============================================================================

// get an instance of the express Router
var router = express.Router();				

// Api Specification Route
router.get('/', function(req, res) {

	res.render('index');

});
	
router.route('/status')
	.get(function(req, res) {
	
		(async () => {
			
			var scanned = await getAsync('pyrk_lastscanblock');
			
			var chaininfo = await client.command('getblockchaininfo');
			var chainblocks = chaininfo.blocks;
			
			message = {chainBlocks: parseInt(chainblocks), scannedBlocks: parseInt(scanned)};
			
			res.json(message);
				
		})();
	
	});
	
router.route('/tokens')
	.get(function(req, res) {

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"tokenDetails.genesis_timestamp_unix":-1};
		
		//if (req.query.sort)
		//{
		//	sort = req.query.sort;
		//}

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('tokens', {}, limit, sort, skip);
	
			qdbapi.close();
		
			res.json(message);
		
		})();
		
	});

router.route('/token/:id')
	.get(function(req, res) {

		var tokenid = req.params.id;
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocument('tokens', {'tokenDetails.tokenIdHex': tokenid});

			qdbapi.close();
			
			res.json(message);
		
		})();
		
	});

router.route('/tokenWithMeta/:id')
	.get(function(req, res) {

		var tokenid = req.params.id;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			message = await qdbapi.findDocument('tokens', {'tokenDetails.tokenIdHex': tokenid});
			
			message.metadata = await qdbapi.findDocuments('metadata', {"metaDetails.tokenIdHex":tokenid}, limit, {"metaDetails.timestamp_unix":-1}, skip);
			
			qdbapi.close();
			
			res.json(message);
		
		})();
		
	});
	
router.route('/tokenByTxid/:txid')
	.get(function(req, res) {

		var txid = req.params.txid;
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('tokens', {'tokenStats.creation_transaction_id': txid});

			qdbapi.close();
			
			res.json(message);
		
		})();
		
	});
	
router.route('/addresses')
	.get(function(req, res) {

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {};

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('addresses', {}, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});

router.route('/address/:addr')
	.get(function(req, res) {

		var addr = req.params.addr;

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('addresses', {"address": addr});

			qdbapi.close();
			
			for (let i = 0; i < message.length; i++)
			{
			
				var pending = Big(0);
		
				var mempooltrx = await hgetAllAsync('pyrk_mempool');

				if (mempooltrx)
				{
					var memkeys = Object.keys(mempooltrx);
					for (let j = 0; j < memkeys.length; j++)
					{
				
						var txid = memkeys[j];
						var txinfo = JSON.parse(mempooltrx[txid]);
					
						if (txinfo.transactiontype == 'SEND' && message[i].tokenIdHex == txinfo.tokenid)
						{
					
							if (txinfo.recipient == addr)
							{
						
								pending = Big(pending).plus(txinfo.realvalue).toFixed(8);
						
							}
						
							if (txinfo.senderaddress == addr)
							{
						
								pending = Big(pending).minus(txinfo.realvalue).toFixed(8);
						
							}
					
					
						}
				
					}
				}
				
				message[i]['pendingBalance'] = Big(pending).toFixed(8);
				if (Big(pending).lt(0))
				{
					message[i]['availableBalance'] = Big(message[i]['tokenBalance']).plus(pending).toFixed(8);
				}
				else
				{
					message[i]['availableBalance'] = message[i]['tokenBalance'];
				}
		
			}
			
			res.json(message);

		})();
				
	});

router.route('/addressesByTokenId/:tokenid')
	.get(function(req, res) {

		var tokenid = req.params.tokenid;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {};

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('addresses', {"tokenIdHex": tokenid}, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});
	
router.route('/balance/:tokenid/:address')
	.get(function(req, res) {

		var addr = req.params.address;
		var tokenid = req.params.tokenid;
		
		updateaccessstats(req);
		
		var message = {};

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);

			var rawRecordId = addr + '.' + tokenid;
			//var recordId = crypto.createHash('md5').update(rawRecordId).digest('hex');
			var recordId = SparkMD5.hash(rawRecordId);
			
			message = await qdbapi.findDocument('addresses', {"recordId": recordId});

			qdbapi.close();
			
			if (message && message.tokenBalance)
			{
			
				var humanbal = new Big(message.tokenBalance).toFixed(8);
				res.json(humanbal);
				
			}
			else
			{
			
				res.json("0");
			
			}
		
		})();
				
	});

router.route('/tokenaddress/:tokenid/:address')
	.get(function(req, res) {

		var addr = req.params.address;
		var tokenid = req.params.tokenid;
		
		updateaccessstats(req);
		
		var message = {};

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);

			var rawRecordId = addr + '.' + tokenid;
			//var recordId = crypto.createHash('md5').update(rawRecordId).digest('hex');
			var recordId = SparkMD5.hash(rawRecordId);
			
			message = await qdbapi.findDocument('addresses', {"recordId": recordId});

			qdbapi.close();
			
			if (message && message.tokenBalance)
			{
			
				var pending = Big(0);
		
				var mempooltrx = await hgetAllAsync('pyrk_mempool');

				if (mempooltrx)
				{
					var memkeys = Object.keys(mempooltrx);
					for (let j = 0; j < memkeys.length; j++)
					{
				
						var txid = memkeys[j];
						var txinfo = JSON.parse(mempooltrx[txid]);
					
						if (txinfo.transactiontype == 'SEND' && message.tokenIdHex == txinfo.tokenid)
						{
					
							if (txinfo.recipient == addr)
							{
						
								pending = Big(pending).plus(txinfo.realvalue).toFixed(8);
						
							}
						
							if (txinfo.senderaddress == addr)
							{
						
								pending = Big(pending).minus(txinfo.realvalue).toFixed(8);
						
							}
					
					
						}
				
					}
					
				}
				
				message['pendingBalance'] = Big(pending).toFixed(8);
				if (Big(pending).lt(0))
				{
					message['availableBalance'] = Big(message['tokenBalance']).plus(pending).toFixed(8);
				}
				else
				{
					message['availableBalance'] = message['tokenBalance'];
				}
		
				res.json(message);
				
			}
			else
			{
			
				res.json({});
			
			}
		
		})();
				
	});
	
router.route('/ismetaauth/:tokenid/:address')
	.get(function(req, res) {

		var addr = req.params.address;
		var tokenid = req.params.tokenid;
		
		updateaccessstats(req);
		
		var message = {};

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);

			var rawRecordId = addr + '.' + tokenid;
			//var recordId = crypto.createHash('md5').update(rawRecordId).digest('hex');
			var recordId = SparkMD5.hash(rawRecordId);
			
			message = await qdbapi.findDocument('addresses', {"recordId": recordId});

			qdbapi.close();
			
			if (message && message.isMetaAuth == true)
			{
			
				res.json({isMetaAuth: true});
				
			}
			else
			{
			
				res.json({isMetaAuth: false});
			
			}
		
		})();
				
	});

router.route('/isowner/:tokenid/:address')
	.get(function(req, res) {

		var addr = req.params.address;
		var tokenid = req.params.tokenid;
		
		updateaccessstats(req);
		
		var message = {};

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);

			var rawRecordId = addr + '.' + tokenid;
			//var recordId = crypto.createHash('md5').update(rawRecordId).digest('hex');
			var recordId = SparkMD5.hash(rawRecordId);
			
			message = await qdbapi.findDocument('addresses', {"recordId": recordId});

			qdbapi.close();
			
			if (message && message.isOwner == true)
			{
			
				res.json({isOwner: true});
				
			}
			else
			{
			
				res.json({isOwner: false});
			
			}
		
		})();
				
	});
	
router.route('/transactions')
	.get(function(req, res) {

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"transactionDetails.timestamp_unix":-1};
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('transactions', {}, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});

router.route('/transaction/:txid')
	.get(function(req, res) {

		var txid = req.params.txid;

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('transactions', {"txid": txid});

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});

router.route('/transaction/:address/:txid')
	.get(function(req, res) {

		var txid = req.params.txid;
		var address = req.params.address;
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('transactions', {$and : [{ $or : [ {"transactionDetails.senderAddress" : address},{"transactionDetails.sendOutput.address" : address}]}, { "txid":txid }]});

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});
	
router.route('/transactions/:tokenid')
	.get(function(req, res) {

		var tokenid = req.params.tokenid;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"transactionDetails.timestamp_unix":-1};

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var mquery = {"transactionDetails.tokenIdHex":tokenid};
			
			message = await qdbapi.findDocuments('transactions', mquery, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});

router.route('/addresstransactions/:address')
	.get(function(req, res) {

		var address = req.params.address;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"transactionDetails.timestamp_unix":-1};

		updateaccessstats(req);
		
		var message = [];

		(async () => {

/*
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
*/

		
			var mempooltrx = await hgetAllAsync('pyrk_mempool');

			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var pmessage = [];

			if (mempooltrx)
			{
				var memkeys = Object.keys(mempooltrx);
				for (let j = 0; j < memkeys.length; j++)
				{
			
					var txid = memkeys[j];
					var txinfo = JSON.parse(mempooltrx[txid]);
				
					if (txinfo.transactiontype == 'SEND' && (address == txinfo.senderaddress || address == txinfo.recipient))
					{
				
						var tokeninfo = await qdbapi.findDocument('tokens', {'tokenDetails.tokenIdHex': txinfo.tokenid});

						var txschema = {
							schema_version: 1,
							txid: txid,
							blockId: null,
							blockHeight: null,
							valid: false,
							invalidReason: "Pending",
							transactionDetails: {
								schema_version: 1,
								transactionType: "SEND",
								senderAddress: txinfo.senderaddress,
								tokenIdHex: txinfo.tokenid,
								versionType: txinfo.versionnum,
								timestamp: "0000-00-00 00:00:00",
								timestamp_unix: 0,
								symbol: tokeninfo.tokenDetails.symbol,
								name: tokeninfo.tokenDetails.name,
								genesisOrBurnQuantity: "0",
								sendOutput: {
									schema_version: 1,
									address: txinfo.recipient,
									amount: txinfo.realvalue,
									paymentId: txinfo.paymentid
								},
								fee_paid: "0"
							}
						};
						
						pmessage.push(txschema);

					}
			
				}

			}
		

			
			var mquery = { 
					$or : 
						[ 
							{"transactionDetails.senderAddress" : address},
							{"transactionDetails.sendOutput.address": address}
					   ]
					};
						
			message = await qdbapi.findDocuments('transactions', mquery, limit, sort, skip);

			qdbapi.close();
			
			res.json(pmessage.concat(message));
		
		})();
				
	});
	
router.route('/transactionsbyaddress/:tokenid/:address')
	.get(function(req, res) {

		var tokenid = req.params.tokenid;
		var address = req.params.address;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"transactionDetails.timestamp_unix":-1};
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var mquery = {
				$and : 
				[
					{ 
						$or : 
						[ 
							{"transactionDetails.senderAddress" : address},
							{"transactionDetails.sendOutput.address": address}
					   ]
					},
					{ 
						"transactionDetails.tokenIdHex":tokenid
					}
				]
			};
			
			message = await qdbapi.findDocuments('transactions', mquery, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});
	
router.route('/metadatabytxid/:txid')
	.get(function(req, res) {

		var txid = req.params.txid;

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('metadata', {"txid": txid});

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});
	
router.route('/metadata/:tokenid')
	.get(function(req, res) {

		var tokenid = req.params.tokenid;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"metaDetails.timestamp_unix":-1};

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var mquery = {"metaDetails.tokenIdHex":tokenid};
			
			message = await qdbapi.findDocuments('metadata', mquery, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});

router.route('/metadata/:tokenid/:address')
	.get(function(req, res) {

		var tokenid = req.params.tokenid;
		var address = req.params.address;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"metaDetails.timestamp_unix":-1};
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var mquery = {
				$and : 
				[
					{ 
						"metaDetails.posterAddress": address
					},
					{ 
						"metaDetails.tokenIdHex":tokenid
					}
				]
			};
			
			message = await qdbapi.findDocuments('metadata', mquery, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});

router.route('/metadatabycode/:tokenid/:metacode')
	.get(function(req, res) {

		var tokenid = req.params.tokenid;
		var metacode = parseInt(req.params.metacode);

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {"metaDetails.timestamp_unix":-1};
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var mquery = {
				$and : 
				[
					{ 
						"metaDetails.metaCode": metacode
					},
					{ 
						"metaDetails.tokenIdHex":tokenid
					}
				]
			};
			
			message = await qdbapi.findDocuments('metadata', mquery, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
				
	});
	
router.route('/tokensByOwner/:owner')
	.get(function(req, res) {
	
		var ownerId = req.params.owner;

		var limit = 100;

		if (req.query.limit)
		{
			limit = parseInt(req.query.limit);
		}

		var page = 1;

		if (req.query.page)
		{
			page = parseInt(req.query.page);
		}
		
		var skip = (page - 1) * limit;

		var sort = {};
		
		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			message = await qdbapi.findDocuments('tokens', {"tokenDetails.ownerAddress": ownerId}, limit, sort, skip);

			qdbapi.close();
			
			res.json(message);
		
		})();
		
	});

	
router.route('/peerInfo')
	.get(function(req, res) {

		updateaccessstats(req);
		
		var thisPeer = myIPAddress + ":" + port;
		
		var message = {goodPeers: goodPeers, badPeers: badPeers, unvalidatedPeers: unvalidatedPeers, thisPeer: thisPeer};

		res.json(message);
		
	});
	
router.route('/getHeight')
	.get(function(req, res) {
	
		updateaccessstats(req);
		
		rclient.get('pyrk_lastscanblock', function(err, reply)
		{
	
			if (err)
			{
				console.log(err);
				var message = {error: 'Height not available'};
			}
			else if (reply == null || parseInt(reply) != reply)
			{

				var message = {height: parseInt(reply)};
				
			}

			res.json(message);
			
		});
		
	});
	
router.route('/getRingSignature/:journalid')
	.get(function(req, res) {
	
		var journalid = parseInt(req.params.journalid);

		updateaccessstats(req);
		
		var message = {};
		
		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var dbreply = await qdbapi.findDocument('journal', {"_id": journalid});

			qdbapi.close();
			
			if (dbreply)
			{
			
				var ringsignature = crypto.createHash('sha256').update(myIPAddress + dbreply.chainHash).digest('hex');

				message = {ip: myIPAddress, port: parseInt(port), journalid: journalid, ringsignature: ringsignature};
			
				res.json(message);
			
			}
			else
			{

				message = {ip: myIPAddress, port: parseInt(port), journalid: journalid, ringsignature: '', error: 'Signature Not Found'};
			
				res.json(message);
			
			}

		})();
		
	});
	
router.route('/getRingSignature/:journalid/:callerport')
	.get(function(req, res) {
	
		var journalid = parseInt(req.params.journalid);
		var callerport = parseInt(req.params.callerport);

		updateaccessstats(req);
		
		var message = {};

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var dbreply = await qdbapi.findDocument('journal', {"_id": journalid});

			qdbapi.close();
			
			if (dbreply)
			{
			
				var ringsignature = crypto.createHash('sha256').update(myIPAddress + dbreply.chainHash).digest('hex');

				message = {ip: myIPAddress, port: parseInt(port), journalid: journalid, ringsignature: ringsignature};
			
				res.json(message);
			
			}
			else
			{

				message = {ip: myIPAddress, port: parseInt(port), journalid: journalid, ringsignature: '', error: 'Signature Not Found'};
			
				res.json(message);
			
			}

		})();
		
		var callerip = getCallerIP(req).toString();
		
		if (!goodPeers[callerip + ":" + callerport] && !unvalidatedPeers[callerip + ":" + callerport])
		{
			unvalidatedPeers[callerip + ":" + callerport] = {ip: callerip, port: parseInt(callerport)};
		}
		
	});
	
router.route('/getJournals/:start/:end')
	.get(function(req, res) {
	
		var startjournalid = parseInt(req.params.start);
		var endjournalid = parseInt(req.params.end);

		updateaccessstats(req);
		
		var message = [];

		(async () => {
		
			var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
		
			var mclient = await qdbapi.connect();
			qdbapi.setClient(mclient);
			
			var dbreply = await qdbapi.findDocuments('journal', { $and: [ { "_id": { $gte: startjournalid } }, { "_id": { $lte: endjournalid } } ] });

			qdbapi.close();
			
			if (dbreply)
			{
			
				for (let i = 0; i < dbreply.length; i++)
				{
				
					var mbody = dbreply[i];
					mbody['chainHash'] = '';
					
					message.push(mbody);
			
				}
				
				res.json(message);
			
			}
			else
			{
			
				res.json(message);
			
			}

		})();
		
	});
	
/////
// Catch any unmatching routes
/////	 
	
router.route('*')
	.get(function(req, res) {
	
		var message = {error: {code: 402, message: 'Method not found', description: 'Check the API documentation to ensure you are calling your method properly.'}};
		res.status(400).json(message);

	})
	
	
// REGISTER OUR ROUTES
// all of our routes will be prefixed with /api
app.use('/api', router);

initialize();

var intervalpeers = setInterval(function() {

	testPeers();
  
}, 60000);

var intervalseeds = setInterval(function() {

	var nowTime = Math.floor(new Date() / 1000);

	if (gotSeedPeers < nowTime - 900) // Check for seeds every 15 minutes
	{
		gotSeedPeers = nowTime;
		getSeedPeers();
	}
	
}, 900000);

function initialize()
{

	(async () => {

		// START THE SERVER
		// =============================================================================
		app.listen(port);
		console.log('Magic happens on Port:' + port);

		myIPAddress = await publicIp.v4();
						
		console.log("This IP Address is: " + myIPAddress);

		getSeedPeers();
		
		runZmq();
		
		// Defaults qm2/qm3
		//validatePeer('95.217.180.3', 80);
		//validatePeer('116.203.40.82', 80);
		
	})();		 

}

async function runZmq() {

  const sock = new zmq.Subscriber

  sock.connect("tcp://127.0.0.1:24242")
  sock.subscribe()
  console.log("Subscriber connected to port 24242")

  for await (const [topic, msg] of sock) {
    newblocknotify();
  }
  
}

// Main Functions
// ==========================


function newblocknotify()
{

	console.log('New Block Notify Received..');
	
	rclient.rpush('blockNotify', 'new');
	
	return true;

}

function validatePeer(peerip, peerport)
{

	if (peerip == myIPAddress) return false;

	peerport = parseInt(peerport);

	var peerapiurl = "http://" + peerip + ":" + peerport + "/api";
	
	(async () => {
	
		var qdbapi = new pyrkDB.default(mongoconnecturl, mongodatabase);
	
		var mclient = await qdbapi.connect();
		qdbapi.setClient(mclient);
		
		var sort = {"_id":-1};
		
		var dbreply = await qdbapi.findDocumentsWithId('journal', {}, 1, sort, 0);

		qdbapi.close();
		
		if (dbreply && dbreply.length > 0)
		{

			var journalid = dbreply[0]['_id'];
			var chainhash = dbreply[0]['chainHash'];

console.log("Validating " + peerip + ":" + peerport + " at journalid " + journalid);

			// This is what the peer hash should be
			
			var ringsignature = crypto.createHash('sha256').update(peerip + chainhash).digest('hex');

console.log("RingSig should be: " + ringsignature);

			request.get(peerapiurl + '/getRingSignature/' + journalid + '/' + port, {json:true}, function (error, response, body) 
			{
			
				if (error)
				{
					// An error occurred, cannot validate
console.log(error);					 
					delete goodPeers[peerip + ":" + peerport];
					delete badPeers[peerip + ":" + peerport];
					unvalidatedPeers[peerip + ":" + peerport] = {ip: peerip, port: peerport};
					
				}
				else
				{
					if (body && !body.error && body.ringsignature)
					{

console.log("RingSig received is: " + body.ringsignature);

						if (body.ringsignature == ringsignature)
						{
						
console.log("Ring sig validated for peer: " + peerip + ":" + peerport);

							// Validated
							goodPeers[peerip + ":" + peerport] = {ip: peerip, port: peerport, lastJournalId: journalid};
							delete unvalidatedPeers[peerip + ":" + peerport];
							delete badPeers[peerip + ":" + peerport];
							getPeers(peerip + ":" + peerport);
						
						}
						else
						{
						
							delete goodPeers[peerip + ":" + peerport];
							delete unvalidatedPeers[peerip + ":" + peerport];
							badPeers[peerip + ":" + peerport] = {ip: peerip, port: peerport, lastJournalId: journalid};
						
						}
					
					}
					else
					{

console.log("Unable to validate at journalid: " + journalid);

						// Cannot validate
						delete goodPeers[peerip + ":" + peerport];
						delete badPeers[peerip + ":" + peerport];
						unvalidatedPeers[peerip + ":" + peerport] = {ip: peerip, port: peerport};
					
					}
				
				}
	
			});

		
		}
		else
		{

console.log("We cannot get ringsig info from journal db... ");
		
		}

	})();

}

function getSeedPeers()
{

	request.get(seedNode + '/peerInfo', {json:true}, function (error, response, body) 
	{
				
		if (error)
		{
			// An error occurred, cannot get seed peer info
						
		}
		else
		{
		
			if (body && body.goodPeers)
			{
			
				var remotePeerList = body.goodPeers;
				
				Object.keys(remotePeerList).forEach(function(k){
				
					if (!goodPeers[k] && !badPeers[k] & !unvalidatedPeers[k])
					{
					
						if (k != myIPAddress + ":" + port)
						{
console.log("Checking peer: " + k);						   
							unvalidatedPeers[k] = remotePeerList[k];
							
						}
					
					}
					
				});
			
			}
			
			if (body && body.thisPeer)
			{
			
				var peerdetails = body.thisPeer.split(":");
			
				if (!goodPeers[body.thisPeer] && !badPeers[body.thisPeer] & !unvalidatedPeers[body.thisPeer])
				{
				
					if (body.thisPeer != myIPAddress + ":" + port)
					{
console.log("Checking peer: " + body.thisPeer);
						unvalidatedPeers[body.thisPeer] = {ip: peerdetails[0], port: parseInt(peerdetails[1])};
						
					}
					
				}
			
			}
		
		}
				
	});

}

function getPeers(peerNode)
{

	request.get(peerNode + '/peerinfo', {json:true}, function (error, response, body) 
	{
				
		if (error)
		{
			// An error occurred, cannot get seed peer info
						
		}
		else
		{
		
			if (body && body.goodPeers)
			{
			
				var remotePeerList = body.goodPeers;
				
				Object.keys(remotePeerList).forEach(function(k){
				
					if (!goodPeers[k] && !badPeers[k] & !unvalidatedPeers[k])
					{
					
						if (k != myIPAddress + ":" + port)
						{
							unvalidatedPeers[k] = remotePeerList[k];
						}

					}
					
				});
			
			}
			
			if (body && body.thisPeer)
			{
			
				var peerdetails = body.thisPeer.split(":");
			
				if (!goodPeers[body.thisPeer] && !badPeers[body.thisPeer] & !unvalidatedPeers[body.thisPeer])
				{
				
					if (body.thisPeer != myIPAddress + ":" + port)
					{
					
						unvalidatedPeers[body.thisPeer] = {ip: peerdetails[0], port: parseInt(peerdetails[1])};
						
					}
					
				}
			
			}
		
		}
		
	});

}

function testPeers()
{

	// Test known peers
	
	Object.keys(unvalidatedPeers).forEach(function(k){
				
		var peerdetails = unvalidatedPeers[k];
		
		validatePeer(peerdetails.ip, peerdetails.port);
					
	});
					
	Object.keys(goodPeers).forEach(function(k){
				
		var peerdetails = goodPeers[k];
		
		validatePeer(peerdetails.ip, peerdetails.port);
					
	});

}


// Access Statistics - Will use this later
// ==========================

function updateaccessstats(req) {

	var ip = getCallerIP(req).toString();
	
	if(accessstats[ip])
	{
		accessstats[ip] = accessstats[ip] + 1;
	}
	else
	{
		accessstats[ip] = 1;
	}

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
 
function getCallerIP(request) 
{
	var ip = request.connection.remoteAddress ||
		request.socket.remoteAddress ||
		request.connection.socket.remoteAddress;
	ip = ip.split(',')[0];
	ip = ip.split(':').slice(-1); //in case the ip returned in a format: "::ffff:146.xxx.xxx.xxx"
	return ip;
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

	var scriptname = 'pyrkApi.js';

	console.log("Error Handle has been called!");

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
	
