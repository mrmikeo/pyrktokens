# QAE  -- Version 1.1.1
Qredit Always Evolving - An easy to use token system for both fungible (QAE-1) and non-fungible (QAE-2) tokens

This is a sidechain for the Qredit network to integrate Simple Token issuance and management

This must be running on a Qredit Relay or Qredit Full node.

Install Mongodb & Redis:  (Default settings are fine for testing)

```
apt-get install mongodb
apt-get install redis-server

```

Enable Webhooks in your Qredit Node:

```
vi .config/qredit-core/mainnet/.env
```

Make sure the env file has these items:

```
CORE_WEBHOOKS_ENABLED=true
CORE_WEBHOOKS_HOST=0.0.0.0
CORE_WEBHOOKS_PORT=4104
```

Clone the repository and setup config:

```
npm install
mkdir /etc/qae/
cp qae.ini.example /etc/qae/qae.ini
```

Run the programs:

qaeApi.js - The API interface to the QAE system
qaeParser.js - The Qredit block parser

```
pm2 qaeApi.js
pm2 qaeParser.js
```

The server runs on the port set in the ini file.   If you want to run on a port < 1000, you'll need to run qaeApi.js with sudo

Currently the system supports the QAE-1 contract schema (v15).   QAE-2 contract schema (v15) is currently in development.

QAE-1 (Schema v15) Contract Methods:

```
GENESIS - Create a new token
BURN - Destroy/Burn tokens from a contract
MINT - Create/Mint tokens into a contract
SEND - Send tokens from sender address to recipient address
PAUSE - Pause the contract.  Prevents any calls other than RESUME
RESUME - Resume the contract.
NEWOWNER - Change the owner of the contract.
FREEZE - Freeze balance for Token @ Address.
UNFREEZE - UnFreeze balance for Token @ Address.
```

JSON Variables:

GENESIS:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
de = Decimal Places  (Integer: 0-8)
sy = Symbol / Ticker  (String: 3-8 characters)
na = Token Name  (String: 3-24 characters)
du = Document URI  (String:  Max 32 characters)  (Optional)
qt = Quantity (Integer)
no = Notes  (String: Max 32 Characters)  (Optional)
pa = Pausable (Boolean:  Default false)  (Optional)
mi = Mintable (Boolean:  Default false)  (Optional)
```

BURN:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
qt = Quantity (Integer)
no = Notes  (String: Max 32 Characters)  (Optional)
```

MINT:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
qt = Quantity (Integer)
no = Notes  (String: Max 32 Characters)  (Optional)
```

SEND:  (Recipent Address is whom you are sending Tokens to)

```
id = tokenIdHex (Hexidecimal)
qt = Quantity (Integer)
no = Notes  (String: Max 32 Characters)  (Optional)
```

PAUSE:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

RESUME:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

NEWOWNER:  (Recipent Address is whom you are reassigning contract to)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

FREEZE:  (Recipent Address is whom you want to freeze)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

UNFREEZE:  (Recipent Address is whom you want to unfreeze)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```


QAE-2 (Schema v15) Contract Methods:

```
GENESIS - Create a new token
PAUSE - Pause the contract.  Prevents any calls other than RESUME
RESUME - Resume the contract.
NEWOWNER - Change the owner of the contract.
AUTHMETA - Authorize an address to add meta data
REVOKEMETA - Revoke authorization to add meta data
CLONE - Create new token by cloning this contract information
ADDMETA - Add meta data to a contract
```

JSON Variables:

GENESIS:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
sy = Symbol / Ticker  (String: 3-8 characters)
na = Token Name  (String: 3-24 characters)
du = Document URI  (String:  Max 32 characters)  (Optional)
no = Notes  (String: Max 32 Characters)  (Optional)
pa = Pausable (Boolean:  Default false)  (Optional)
```

PAUSE:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

RESUME:  (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```
NEWOWNER:  (Recipent Address is whom you are reassigning contract to)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

AUTHMETA:  (Recipent Address is whom you are authorizing to add metadata)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

REVOKEMETA:	  (Recipent Address is whom you are revoking access to add metadata)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional)
```

CLONE:   (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
no = Notes  (String: Max 32 Characters)  (Optional - Leaveing blank will copy notes from original, providing will create new notes)
```

ADDMETA:   (Recipient Address is QAE Master - QjeTQp29p9xRvTcoox4chc6jQZAHwq87JC)

```
id = tokenIdHex (Hexidecimal)
ch = Chunk number (Integer - Optional / 0 is Default -- If your metadata cannot fit into a single transaction, then chunk it into multiple, ie, 1 of 2, 2 of 2)
na = Name  (String: Max 32 Characters --  name of meta info)
dt = Data  (String -- stringified data for your meta)
```
