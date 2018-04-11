var config = require("../../config.js"); var utils = require("../../utils.js");
if(!config['all'] && !config[__filename.split('\\').slice(-1)[0]]) {
	return;
}


var RequestCore = artifacts.require("./core/RequestCore.sol");
var RequestBitcoinOffline = artifacts.require("./synchrone/RequestBitcoinOffline.sol");


var BigNumber = require('bignumber.js');


contract('RequestBitcoinOffline createRequestAsPayee',  function(accounts) {
	var admin = accounts[0];
	var burnerContract = accounts[1];

	var payer = accounts[3];
	var payee = accounts[4];
	var payee2 = accounts[5];
	var payee3 = accounts[6];

	var payeePayment = accounts[7];
	var payee2Payment = accounts[8];
	var payee3Payment = accounts[9];

	var requestCore;
	var requestBitcoinOffline;

	var arbitraryAmount = 100000;
	var arbitraryAmount2 = 20000;
	var arbitraryAmount3 = 30000;

	var payeePayment = 'mxp1Nmde8EyuB93YanAvQg8uSxzCs1iycs';
	var payee2Payment = 'mgUVRGCtdXd6PFKMmy2NsP6ENv2kajXaGV';
	var payee3Payment = 'n4jWwb24iQGPcBzPbXvhoE7N3CBCxWUE5y';
	var payeeRefund = 'mg5AMpbvbKU6D6k3eUe4R7Q4jbcFimPTF9';
	var payee2Refund = 'mqbRwd1488VLFdJfMQQyKis4RgHH6epcAW';
	var payee3Refund = 'mopMp1tpQzCXbXKLH9UVQxDoaDEjM76muv';

    beforeEach(async () => {
		requestCore = await RequestCore.new();

    	requestBitcoinOffline = await RequestBitcoinOffline.new(requestCore.address, burnerContract, {from:admin});

		await requestCore.adminAddTrustedCurrencyContract(requestBitcoinOffline.address, {from:admin});
    });

	it("new request OK", async function () {
		var r = await requestBitcoinOffline.createRequestAsPayeeAction(
												[payee,payee2,payee3],
												utils.createBytesForPaymentBitcoinAddress([payeePayment,payee2Payment,payee3Payment]), 
												[arbitraryAmount,arbitraryAmount2,arbitraryAmount3], 
												payer, 
												utils.createBytesForPaymentBitcoinAddress([payeeRefund,payee2Refund,payee3Refund]),
												"", 
												{from:payee});
		
		var l = utils.getEventFromReceipt(r.receipt.logs[0], requestCore.abi);
		assert.equal(l.name,"Created","Event Created is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[0].topics[1],utils.getRequestId(requestCore.address, 1),"Event Created wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[2]).toLowerCase(),payee,"Event Created wrong args payee");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[3]).toLowerCase(),payer,"Event Created wrong args payer");
		assert.equal(l.data[0].toLowerCase(),payee,"Event Created wrong args creator");
		assert.equal(l.data[1],'',"Event Created wrong args data");

		var l = utils.getEventFromReceipt(r.receipt.logs[1], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[1].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[1].topics[2]).toLowerCase(),payee2,"Event NewSubPayee wrong args subPayee");

		var l = utils.getEventFromReceipt(r.receipt.logs[2], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[2].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[2].topics[2]).toLowerCase(),payee3,"Event NewSubPayee wrong args subPayee");

		var r = await requestCore.getRequest.call(utils.getRequestId(requestCore.address, 1));
		assert.equal(r[0],payer,"request wrong data : payer");
		assert.equal(r[1],requestBitcoinOffline.address,"new request wrong data : currencyContract");
		assert.equal(r[2],0,"new request wrong data : state");
		assert.equal(r[3],payee,"request wrong data : payee");
		assert.equal(r[4],arbitraryAmount,"request wrong data : expectedAmount");
		assert.equal(r[5],0,"new request wrong data : balance");

		var count = await requestCore.getSubPayeesCount.call(utils.getRequestId(requestCore.address,1));
		assert.equal(count,2,"number of subPayee wrong");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r[0],payee2,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount2,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r[0],payee3,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount3,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r,payeePayment,"wrong payeesPaymentAddress 2");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r,payee2Payment,"wrong payeesPaymentAddress 2");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),2);	
		assert.equal(r,payee3Payment,"wrong payeesPaymentAddress 3");

		var r = await requestBitcoinOffline.payerRefundAddress.call(utils.getRequestId(requestCore.address, 1),0);
		assert.equal(r,payeeRefund,"wrong payeeRefund");

		var r = await requestBitcoinOffline.payerRefundAddress.call(utils.getRequestId(requestCore.address, 1),1);
		assert.equal(r,payee2Refund,"wrong payee2Refund");

		var r = await requestBitcoinOffline.payerRefundAddress.call(utils.getRequestId(requestCore.address, 1),2);
		assert.equal(r,payee3Refund,"wrong payee3Refund");
	});
/*
	it("new request second payee without payment address", async function () {
		var r = await requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [payeePayment,0,payee3Payment], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, payerPayment, "", {from:payee});
		
		var l = utils.getEventFromReceipt(r.receipt.logs[0], requestCore.abi);
		assert.equal(l.name,"Created","Event Created is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[0].topics[1],utils.getRequestId(requestCore.address, 1),"Event Created wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[2]).toLowerCase(),payee,"Event Created wrong args payee");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[3]).toLowerCase(),payer,"Event Created wrong args payer");
		assert.equal(l.data[0].toLowerCase(),payee,"Event Created wrong args creator");
		assert.equal(l.data[1],'',"Event Created wrong args data");

		var l = utils.getEventFromReceipt(r.receipt.logs[1], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[1].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[1].topics[2]).toLowerCase(),payee2,"Event NewSubPayee wrong args subPayee");

		var l = utils.getEventFromReceipt(r.receipt.logs[2], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[2].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[2].topics[2]).toLowerCase(),payee3,"Event NewSubPayee wrong args subPayee");

		var r = await requestCore.getRequest.call(utils.getRequestId(requestCore.address, 1));
		assert.equal(r[0],payer,"request wrong data : payer");
		assert.equal(r[1],requestBitcoinOffline.address,"new request wrong data : currencyContract");
		assert.equal(r[2],0,"new request wrong data : state");
		assert.equal(r[3],payee,"request wrong data : payee");
		assert.equal(r[4],arbitraryAmount,"request wrong data : expectedAmount");
		assert.equal(r[5],0,"new request wrong data : balance");

		var count = await requestCore.getSubPayeesCount.call(utils.getRequestId(requestCore.address,1));
		assert.equal(count,2,"number of subPayee wrong");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r[0],payee2,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount2,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r[0],payee3,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount3,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r,payeePayment,"wrong payeesPaymentAddress 1");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r,0,"wrong payeesPaymentAddress 2");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),2);	
		assert.equal(r,payee3Payment,"wrong payeesPaymentAddress 3");

		var r = await requestBitcoinOffline.payerRefundAddress.call(utils.getRequestId(requestCore.address, 1));
		assert.equal(r,payerPayment,"wrong payerRefundAddress");
	});

	it("new request with negative amount", async function () {
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [payeePayment,payee2Payment,payee3Payment], [arbitraryAmount,-arbitraryAmount2,arbitraryAmount3], payer, payerPayment, "", {from:payee}));
	});

	it("basic check on payee payer", async function () {
		// new request payer==0 OK
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], 0, 0, "", {from:payee}));
		// new request payee==payer impossible
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payer,payee2,payee3], [], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, 0, "", {from:payee}));
	});

	it("basic check on expectedAmount", async function () {
		// new request _expectedAmount >= 2^256 impossible
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [], [new BigNumber(2).pow(256),arbitraryAmount2,arbitraryAmount3], payer, 0, "", {from:payee}));
	});

	it("impossible to createRequest if Core Paused", async function () {
		await requestCore.pause({from:admin});
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, 0, "", {from:payee}));
	});

	it("new request when currencyContract not trusted Impossible", async function () {
		var requestBitcoinOffline2 = await RequestBitcoinOffline.new(requestCore.address,{from:admin});
		await utils.expectThrow(requestBitcoinOffline2.createRequestAsPayee([payee,payee2,payee3], [], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, 0, "", {from:payee}));
	});

	it("new request with fees", async function () {
		await requestBitcoinOffline.setFeesPerTenThousand(10); // 0.01% fees
		var fees = await requestBitcoinOffline.collectEstimation(arbitraryAmount+arbitraryAmount2+arbitraryAmount3);
		var balanceBurnerContractBefore = await web3.eth.getBalance(burnerContract);

		var r = await requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [payeePayment,payee2Payment,payee3Payment], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, payerPayment, "", {value:fees, from:payee});
		
		var l = utils.getEventFromReceipt(r.receipt.logs[0], requestCore.abi);
		assert.equal(l.name,"Created","Event Created is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[0].topics[1],utils.getRequestId(requestCore.address, 1),"Event Created wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[2]).toLowerCase(),payee,"Event Created wrong args payee");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[0].topics[3]).toLowerCase(),payer,"Event Created wrong args payer");
		assert.equal(l.data[0].toLowerCase(),payee,"Event Created wrong args creator");
		assert.equal(l.data[1],'',"Event Created wrong args data");

		var l = utils.getEventFromReceipt(r.receipt.logs[1], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[1].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[1].topics[2]).toLowerCase(),payee2,"Event NewSubPayee wrong args subPayee");

		var l = utils.getEventFromReceipt(r.receipt.logs[2], requestCore.abi);
		assert.equal(l.name,"NewSubPayee","Event NewSubPayee is missing after createRequestAsPayee()");
		assert.equal(r.receipt.logs[2].topics[1],utils.getRequestId(requestCore.address, 1),"Event NewSubPayee wrong args requestId");
		assert.equal(utils.bytes32StrToAddressStr(r.receipt.logs[2].topics[2]).toLowerCase(),payee3,"Event NewSubPayee wrong args subPayee");

		var r = await requestCore.getRequest.call(utils.getRequestId(requestCore.address, 1));
		assert.equal(r[0],payer,"request wrong data : payer");
		assert.equal(r[1],requestBitcoinOffline.address,"new request wrong data : currencyContract");
		assert.equal(r[2],0,"new request wrong data : state");
		assert.equal(r[3],payee,"request wrong data : payee");
		assert.equal(r[4],arbitraryAmount,"request wrong data : expectedAmount");
		assert.equal(r[5],0,"new request wrong data : balance");

		var count = await requestCore.getSubPayeesCount.call(utils.getRequestId(requestCore.address,1));
		assert.equal(count,2,"number of subPayee wrong");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r[0],payee2,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount2,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestCore.subPayees.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r[0],payee3,"request wrong data : payer");
		assert.equal(r[1],arbitraryAmount3,"new request wrong data : expectedAmount");
		assert.equal(r[2],0,"new request wrong data : balance");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),0);	
		assert.equal(r,payeePayment,"wrong payeesPaymentAddress 2");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),1);	
		assert.equal(r,payee2Payment,"wrong payeesPaymentAddress 2");

		var r = await requestBitcoinOffline.payeesPaymentAddress.call(utils.getRequestId(requestCore.address, 1),2);	
		assert.equal(r,payee3Payment,"wrong payeesPaymentAddress 3");

		var r = await requestBitcoinOffline.payerRefundAddress.call(utils.getRequestId(requestCore.address, 1));
		assert.equal(r,payerPayment,"wrong payerRefundAddress");

		assert((await web3.eth.getBalance(burnerContract)).sub(balanceBurnerContractBefore).equals(fees),"new request wrong data : amount to burnerContract");
	});

	it("impossible to createRequest if msg.value < fees", async function () {
		await requestBitcoinOffline.setFeesPerTenThousand(10); // 0.01% fees
		var fees = await requestBitcoinOffline.collectEstimation(arbitraryAmount+arbitraryAmount2+arbitraryAmount3);
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, 0, "", {value:fees-1, from:payee}));
	});
	it("impossible to createRequest if msg.value > fees", async function () {
		await requestBitcoinOffline.setFeesPerTenThousand(10); // 0.01% fees
		var fees = await requestBitcoinOffline.collectEstimation(arbitraryAmount+arbitraryAmount2+arbitraryAmount3);
		await utils.expectThrow(requestBitcoinOffline.createRequestAsPayee([payee,payee2,payee3], [], [arbitraryAmount,arbitraryAmount2,arbitraryAmount3], payer, 0, "", {value:fees+1, from:payee}));
	});


	it("impossible change fees if not admin", async function () {
		await utils.expectThrow(requestBitcoinOffline.setFeesPerTenThousand(10,{from:payee})); 
	});
	it("impossible change maxCollectable if not admin", async function () {
		await utils.expectThrow(requestBitcoinOffline.setMaxCollectable(10000000,{from:payee})); 
	});
*/
});

