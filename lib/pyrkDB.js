/*
*
* Pyrk Tokens - Version 1.1.1
*
*
* A simplified token management system for the Pyrk network
*
* PyrkDB
*
*/


/*
* MongoDB Functions
*/

const MongoClient			= require('mongodb').MongoClient;
const autoIncrement 		= require("mongodb-autoincrement");
const assert				= require('assert');
const Big					= require('big.js');
const SparkMD5				= require('spark-md5');  // Faster than crypto
const _						= require('underscore-node');

var pyrkDB = /** @class */ (function () 
{

	var connectionString;
	var dbName;
	var db;
	var client;

	function pyrkDB(connectionString, dbName) 
	{
		if (connectionString === void 0)
			this.connectionString = 'mongodb://localhost:27017';
		else
			this.connectionString = connectionString;
			
		if (dbName === void 0)
			this.dbName = 'pyrksimpletokens';
		else
			this.dbName = dbName;
		
		return this;
		
	}

	pyrkDB.prototype.connect = function() 
	{
		
		var connectionString = this.connectionString;
		var dbName = this.dbName;
	
		return new Promise((resolve, reject) => {
			
			MongoClient.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true }, function(error, client) 
			{

				if (error) {
					console.log("MongoDB Connection Error!");
					reject(error); return;
				}
								
				//console.log("Connected Correctly to MongoDB Server - Database: " + dbName);
				
				resolve(client);

			});
		
		});
		
	}

	pyrkDB.prototype.setClient = function (client)
	{
		
		this.client = client;
		this.db = client.db(this.dbName);
		return true;
	
	};
	
	pyrkDB.prototype.ping = function ()
	{
		
		return new Promise((resolve, reject) => {
		
			this.db.command({ping:1}, function(error, reply) 
			{
				if (error) {
					reject(error); return;
				}
				resolve(reply);				   
			});
			
		}); 
	
	};
	
	pyrkDB.prototype.close = function (client)
	{
	
		return this.client.close();
	
	};
	
	/* Just a testing function */
	pyrkDB.prototype.getConnectionString = function ()
	{
	
		return this.connectionString;
	
	};
	
	pyrkDB.prototype.findDocument = function(collection, query) 
	{
	
		var collection = this.db.collection(collection);
		
		return new Promise((resolve, reject) => {
			
			collection.findOne(query, {projection:{ _id: 0 }}, function(error, docs) 
			{

				if (error) {
					reject(error); return;
				}
				resolve(docs);

			});
		
		});
		
	}
	
	pyrkDB.prototype.findDocuments = function(collection, query, limit = 100, sort = {}, skip = 0) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
		
			collection.find(query, {projection:{ _id: 0 }, limit: limit, sort: sort, skip: skip}).toArray(function(error, docs) 
			{

				if (error) {
					reject(error); return;
				}
				resolve(docs);

			});
		
		});
		
	}

	pyrkDB.prototype.findDocumentsWithId = function(collection, query, limit = 100, sort = {}, skip = 0) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
		
			collection.find(query, {limit: limit, sort: sort, skip: skip}).toArray(function(error, docs) 
			{

				if (error) {
					reject(error); return;
				}
				resolve(docs);

			});
		
		});
		
	}
	
	pyrkDB.prototype.findDocumentCount = function(collection, query) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
		
			collection.find(query, {}).count(function(error, count) 
			{

				if (error) {
					reject(error); return;
				}
				resolve(count);

			});
		
		});
		
	}
	
	pyrkDB.prototype.findDocumentBigSum = function(collection, query, sumfield) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
		
			collection.find(query, {}).toArray(function(error, results) 
			{

				if (error) {
					reject(error); return;
				}
								
				let sum = _.reduce(results, function(memo, thisdoc)
				{ 
					try {
						return new Big(memo).plus(eval("thisdoc." + sumfield));
					} catch (e) {
						return new Big(memo);
					}
					
				}, 0);
				
				resolve(sum);

			});
		
		});
		
	}
	
	pyrkDB.prototype.findDocumentHash = function(collection, query, field, sort) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
		
			collection.find(query, {projection:{ _id: 0 }, limit: 10, sort: sort, skip: 0}).toArray(function(error, results) 
			{

				if (error) {
					reject(error); return;
				}
								
				let fieldcat = _.reduce(results, function(memo, thisdoc)
				{ 
				
					return memo + '' + eval("thisdoc." + field);

				}, 0);

				if (fieldcat)
				{
					var hashcat = SparkMD5.hash(fieldcat);
				}
				else
				{
					var hashcat = SparkMD5.hash('');
				}
				
				resolve(hashcat);
				
			
			});
		
		});
		
	}

	pyrkDB.prototype.insertDocument = function(collection, query) 
	{

		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
					
			collection.insertOne(query, function(error, result) 
			{
			
				if (error) {
					console.log(query);
					reject(error); return;
				}
				resolve(result);
			
			});
		
		});
		
	}

	pyrkDB.prototype.insertDocuments = function(collection, query) 
	{

		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
			
			collection.insertMany([query], function(error, result) 
			{
			
				if (error) {
					reject(error); return;
				}
				resolve(result);
			
			});
		
		});
		
	}
	
	
	pyrkDB.prototype.createJournalEntry = function(txid, blockId, blockHeight, timestamp, timestampUnix, action, collectionName, fieldData, recordData)
	{

		return new Promise((resolve, reject) => {
		
			var collection = this.db.collection('journal');

			autoIncrement.getNextSequence(this.db, 'journal', "_id", function (err, autoIndex) 
			{
			
				delete fieldData['_id'];
				delete recordData['_id'];
				
				var recordHash = SparkMD5.hash(action + '' + JSON.stringify(fieldData) + '' + JSON.stringify(recordData));
		
				var insertData = {
					txid: txid,
					blockId: blockId,
					blockHeight: blockHeight,
					timestamp: timestamp,
					timestamp_unix: timestampUnix,
					action: action,
					collectionName: collectionName,
					fieldData: JSON.stringify(fieldData),
					recordData: JSON.stringify(recordData),  
					recordHash: recordHash,
					chainHash: ''
					};

				if (autoIndex > 1)
				{
					var lastIndex = parseInt(Big(autoIndex).minus(1).toFixed(0));
				}
				else
				{
					var lastIndex = 0;
				}
				
				insertData._id = autoIndex;

console.log('autoIndex: ' + autoIndex);

				collection.insertOne(insertData, function(error, result) 
				{

					if (error) {
						console.log('Error at pyrkDB - 992378DKDH');
						console.log(error);
						reject(error); return;
					}

					if (autoIndex == 1) // This is the first entry
					{
		
						// chainHash = recordHash
console.log('update after insert #1 - ' + recordHash);

						collection.updateOne({"_id": autoIndex }, { $set: {"chainHash": recordHash } }, function(error, updateresult) 
						{
		
							if (error) {
								console.log('Error at pyrkDB - DKCHKFC887');
								console.log(error);
								reject(error); return;
							}
							resolve(updateresult);
			
						});
			
					}
					else
					{

						collection.findOne({'_id': lastIndex}, {}, function(error, docs) 
						{

							if (error) {
								console.log('Error at pyrkDB - CKSE9923H');
								console.log(error);
								reject(error); return;
							}

console.log('lastRecordHash: ' + docs.recordHash);

							var chainHash = SparkMD5.hash(docs.recordHash + '' + recordHash);

console.log('chainHash: ' + chainHash);

							collection.updateOne({"_id": autoIndex }, { $set: {"chainHash": chainHash } }, function(error, result) 
							{

								if (error) {
									console.log('Error at pyrkDB - 9923KDHS');
									console.log(error);
									reject(error); return;
								}
								resolve(result);

							});


						});
		
					}
			
		
				});
		
			});
			
		});
	
	}

	pyrkDB.prototype.updateDocument = function(collection, findquery, setquery) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
			
			collection.updateOne(findquery, { $set: setquery }, function(error, result) 
			{
			
				if (error) {
					reject(error); return;
				}
				resolve(result);
				
			});
		
		});
		
	}
	
	pyrkDB.prototype.removeDocument = function(collection, query) 
	{
	
		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
			
			collection.deleteOne(query, function(error, result) 
			{
			
				if (error) {
					reject(error); 
					return;
				}
				resolve(result);
				
			});
		
		});
		
	}
	
	pyrkDB.prototype.removeDocuments = function(collection, query) 
	{

		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
			
			collection.deleteMany(query, function(error, result) 
			{
			
				if (error) {
					reject(error); 
					return;
				}
				resolve(result);
				
			});
		
		});
		
	}
	
	pyrkDB.prototype.createIndex = function(collection, query, unique = true) 
	{

		var collection = this.db.collection(collection);

		return new Promise((resolve, reject) => {
		
			if (unique == true) sparse = false;
			else sparse = true;
			
			collection.createIndex(query, {background: true, sparse: sparse, unique: unique}, function(error, result) 
			{
						
				if (error) {
					reject(error); 
					return;
				}
				resolve(result);
				
			});
		
		});
		
	}

	pyrkDB.prototype.createCollection = function(collection, options = {}) 
	{

		var db = this.db;
		
		return new Promise((resolve, reject) => {
			
			db.createCollection(collection, options, function(error, result) 
			{
			
				if (error) {
					reject(error); 
					return;
				}
				resolve(result);
				
			});
		
		});
		
	}
	
	pyrkDB.prototype.dropCollection = function(collection, options = {}) 
	{

		var collection = this.db.collection(collection);
		
		return new Promise((resolve, reject) => {

			collection.drop(function(error, result) 
			{
						
				if (error) {
					reject(error); 
					return;
				}
				resolve(result);
				
			});
		
		});
		
	}
	
	pyrkDB.prototype.doesCollectionExist = function(collection) 
	{

		var db = this.db;
		
		return new Promise((resolve, reject) => {

			db.listCollections().toArray(function(err, items)
			{

				if (err) 
				{
					reject(err); 
					return;
				}
				
				if (items.length == 0) 
				{
					resolve(false);
					return;
				}
	
				for (var i = 0; i < items.length; i++) {
					if (items[i].name == collection)
					{
						resolve(true);
						return;
					}
				}
				
				resolve(false);
				
			}); 
			
		});
		
	}
	
	return pyrkDB;
	
}());

exports.default = pyrkDB;
