const pyrkcore = require('@pyrkcommunity/pyrkcore-lib');

/*
var privateKey = new pyrkcore.PrivateKey();

var exported = privateKey.toWIF();
var imported = pyrkcore.PrivateKey.fromWIF(exported);
var hexa = privateKey.toString();

var address = privateKey.toAddress();

console.log(privateKey);
console.log(exported);
console.log(address);

<PrivateKey: c46ea3acd40b4133d213c2e3a5e99de79b09ba97d5317c1ccb82bff1ec9a7d26, network: livenet>
UBhEGF9saMe6bqNSmHNjXcUxAFJS86oZbXmjxTdD32J3Wsg7oziB
<Address: PJPXosSkWoBaob5CtySkghTHuUexsRgbxU, type: pubkeyhash, network: livenet>

*/

/*

 {
    "txid": "f77efd3beb1364126d297582fc36acf32679d0ae7c985f839b58892063afc3ff",
    "vout": 0,
    "address": "PBTKDCevx2muSBh8QVtKGcAxHLmLCSSXot",
    "account": "MN132",
    "scriptPubKey": "76a9141f6bc63133bc3dee5561c9a979b2c706efec2dce88ac",
    "amount": 20.00000000,
    "confirmations": 143,
    "spendable": true,
    "solvable": true,
    "ps_rounds": -2
  }, 

wif: UBPM1dk7sGhssocHCCv9xZM6E5kkJQaJBm3hE4UGNJ1Z2FAc8jWs





*/

var privateKey = pyrkcore.PrivateKey.fromWIF('UCkWn22Pt9MnDH1y7pA5TNmPrSP1FHLguj1wbW44Nqbd5rGhWBEo');

var utxo = {
  "txId" : "7ed94a11dc25044ea88e25f0718f9ab301d9856215d0ff85a20e953d05538bff",
  "outputIndex" : 1,
  "address" : "PVWehAsB67miqrtDaRfRY5ugEcr1Jf6qNM",
  "script" : "76a914e57f8c937ed48d24aa6e7a34fdb3ad11963fc8a788ac",
  "satoshis" : 2000000000
};


// Issue

var tokenTicker = Buffer.from('TEST1', 'utf8').toString('hex');

if (tokenTicker.length < 10) tokenTicker = tokenTicker.padStart(10, '0');
if (tokenTicker.length > 10) tokenTicker = tokenTicker.substr(-10);

var tokenName = Buffer.from('A Test Token', 'utf8').toString('hex');

if (tokenName.length < 40) tokenName = tokenName.padStart(40, '0');
if (tokenName.length > 40) tokenName = tokenName.substr(-40);

var tokenIssue = String(1000000.12345);
var issueSplit = tokenIssue.split('.');

var tokenInteger = Buffer.from(issueSplit[0], 'utf8').toString('hex');

if (tokenInteger.length < 20) tokenInteger = tokenInteger.padStart(20, '0');
if (tokenInteger.length > 20) tokenInteger = tokenInteger.substr(-20);

var tokenDecimal = Buffer.from(issueSplit[1], 'utf8').toString('hex');

if (tokenDecimal.length < 16) tokenDecimal = tokenDecimal.padEnd(16, '0');
if (tokenDecimal.length > 16) tokenDecimal = tokenDecimal.substr(16);

var tokenData = '3432' + '01' + '01' + tokenTicker + tokenName + tokenInteger + tokenDecimal;

console.log(tokenData);

tokenData = Buffer.from(tokenData, 'hex');

console.log(tokenData);
console.log(tokenData.toString('hex'));

var transaction = new pyrkcore.Transaction()
    .from(utxo)
    .change('PVWehAsB67miqrtDaRfRY5ugEcr1Jf6qNM')
    .fee(500000000)
    .addData(tokenData) // Add OP_RETURN data
    .sign(privateKey);

//    .to('PBTKDCevx2muSBh8QVtKGcAxHLmLCSSXot', 1500000000)


    
console.log(transaction.serialize({disableLargeFees: true, disableDustOutputs:true}));

