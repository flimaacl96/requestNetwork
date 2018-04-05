# JS library improvement RFC

## Problem statement
Lower barrier to adoption by making the JS API easier to use.

## Proposal

### Library name and repository
requestNetwork.js => request-network

### Path to implementation
We encapsulate the current library as a set of private, internal, stateless services. The API would be an outer layer for the user to interract with the protocol, through those services. This allows separation of concern, prevent full rewrite and take advantage of the current design of the library.

### Example
```javascript
// import 'RequestNetwork' from 'request-network';

// import HDWalletProvider from 'truffle-hdwallet-provider';
// import Web3 from 'web3';
// const mnemonic = 'butter route frozen life lizard laundry kiwi able second meadow company confirm';
// const provider = new HDWalletProvider(mnemonic, this.infuraNodeUrl);
// this.web3 = new Web3(provider.engine);
// this.rn = new RequestNetwork(provider, 1);

// const requestNetwork = new RequestNetwork({
//   provider,
//   networkId,
//   useIpfsPublic
// });

// const request = await requestNetwork.createRequest(
//   as: RequestNetwork.Role.Payer,
//   payees: [{
//    idAddress: '0x01',
//    paymentAddress: '0x02'
//    expectedAmount: 1.43
//   }],
//   payer: {
//     idAddress: '0x03',
//     refundAddress '0x04',
//   }
// );

// request.pay().on('broadcasted', txHash => {})
// ```

### Constructor
```javascript
import 'RequestNetwork' from 'request-network';
const requestNetwork = new RequestNetwork(options);
```

### Broadcasted events
```javascript
request.accept().on('broadcasted', txHash => {})
```

### Features
#### Create request
```javascript
const request = requestNetwork.createRequest(
  as: RequestNetwork.Role.Payer,
  payees: [{
   idAddress: '0x01',
   paymentAddress: '0x02'
   expectedAmount: 1.43
  }],
  payer: {
    idAddress: '0x03',
    refundAddress '0x04',
  },
  data: {...}
  ethereumOptions: {...}
)
```

#### Retrieve a request from its id
```javascript
new requestNetwork.Request(requestId)
```

#### Sign Request
```javascript
request.sign()
```

#### Broadcast a signed transaction
```javascript
request.broadcast()
```

#### Check a signed request
```javascript
request.isSigned && request.isSignatureValid()
// Or
RequestNetowk.isSignatureValid()
```

#### Cancel, pay, refund, add substract/additional, etc
```javascript
request.cancel(), etc
```

### Properties
 * State

