import BitcoinService from '../servicesExternal/bitcoin-service';

import RequestCoreService from '../servicesCore/requestCore-service';
import Ipfs from '../servicesExternal/ipfs-service';

import Web3Single from '../servicesExternal/web3-single';

import * as ServiceContracts from '../servicesContracts';

import * as Types from '../types';

import * as ETH_UTIL from 'ethereumjs-util';

import * as walletAddressValidator from 'wallet-address-validator';

// @ts-ignore
import * as Web3PromiEvent from 'web3-core-promievent';

// @ts-ignore
const ETH_ABI = require('../lib/ethereumjs-abi-perso.js');

const BN = Web3Single.BN();

const EMPTY_BYTES_20 = '0x0000000000000000000000000000000000000000';

/**
 * The RequestBitcoinOfflineService class is the interface for the Request Bitcoin currency contract with only offchain check
 */
export default class RequestBitcoinOfflineService {
    protected ipfs: any;

    // RequestCore on blockchain
    /**
     * RequestCore contract's abi
     */
    protected abiRequestCoreLast: any;
    /**
     * RequestCore service from this very lib
     */
    protected requestCoreServices: any;

    // RequestBitcoinOffline on blockchain
    /**
     * RequestBitcoinOffline contract's abi
     */
    protected abiRequestBitcoinOfflineLast: any;
    /**
     * RequestBitcoinOffline contract's address
     */
    protected addressRequestBitcoinOfflineLast: string;
    /**
     * RequestBitcoinOffline contract's web3 instance
     */
    protected instanceRequestBitcoinOfflineLast: any;

    private bitcoinService: BitcoinService;

    private web3Single: Web3Single;

    /**
     * constructor to Instantiates a new RequestBitcoinOfflineService
     */
    constructor() {
        this.bitcoinService = BitcoinService.getInstance();
        this.web3Single = Web3Single.getInstance();
        this.ipfs = Ipfs.getInstance();

        this.abiRequestCoreLast = this.web3Single.getContractInstance('last-RequestCore').abi;
        this.requestCoreServices = new RequestCoreService();

        const requestBitcoinOfflineLastArtifact = this.web3Single.getContractInstance('last-RequestBitcoinOffline');
        if (!requestBitcoinOfflineLastArtifact) {
            throw Error('RequestBitcoinOffline Artifact: no config for network : "' + this.web3Single.networkName + '"');
        }
        this.abiRequestBitcoinOfflineLast = requestBitcoinOfflineLastArtifact.abi;
        this.addressRequestBitcoinOfflineLast = requestBitcoinOfflineLastArtifact.address;
        this.instanceRequestBitcoinOfflineLast = requestBitcoinOfflineLastArtifact.instance;
    }

    /**
     * create a request as payee
     * @dev emit the event 'broadcasted' with {transaction: {hash}} when the transaction is submitted
     * @param   _payeesIdAddress           ID addresses of the payees (the position 0 will be the main payee, must be the broadcaster address)
     * @param   _expectedAmounts           amount initial expected per payees for the request
     * @param   _payer                     address of the payer
     * @param   _payeesPaymentAddress      Bitcoin payment addresses of the payees (the position 0 will be the main payee)
     * @param   _payerRefundAddress        Bitcoin refund address of the payer
     * @param   _data                      Json of the request's details (optional)
     * @param   _extension                 address of the extension contract of the request (optional) NOT USED YET
     * @param   _extensionParams           array of parameters for the extension (optional) NOT USED YET
     * @param   _options                   options for the method (gasPrice, gas, value, from, numberOfConfirmation)
     * @return  promise of the object containing the request and the transaction hash ({request, transactionHash})
     */
    public createRequestAsPayee(
        _payeesIdAddress: string[],
        _expectedAmounts: any[],
        _payer: string,
        _payeesPaymentAddress: string[],
        _payerRefundAddress: string[],
        _data ?: string,
        _extension ?: string,
        _extensionParams ?: any[] ,
        _options ?: any,
        ): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();
        _expectedAmounts = _expectedAmounts.map((amount) => new BN(amount));

        const expectedAmountsTotal = _expectedAmounts.reduce((a, b) => a.add(b), new BN(0));

        _options = this.web3Single.setUpOptions(_options);

        this.web3Single.getDefaultAccountCallback(async (err, defaultAccount) => {
            if (!_options.from && err) return promiEvent.reject(err);
            const account = _options.from || defaultAccount;

            if (_payeesIdAddress.length !== _expectedAmounts.length || _payeesIdAddress.length !== _payeesPaymentAddress.length || _payeesIdAddress.length !== _payerRefundAddress.length) {
                return promiEvent.reject(Error('_payeesIdAddress, _expectedAmounts, _payerRefundAddress and _payeesPaymentAddress must have the same size'));
            }
            if (!this.web3Single.isArrayOfAddressesNoChecksum(_payeesIdAddress)) {
                return promiEvent.reject(Error('_payeesIdAddress must be valid eth addresses'));
            }
            if (!this.isArrayOfBitcoinAddresses(_payeesPaymentAddress)) {
                return promiEvent.reject(Error('_payeesPaymentAddress must be valid eth addresses'));
            }

            if ( !this.web3Single.areSameAddressesNoChecksum(account, _payeesIdAddress[0]) ) {
                return promiEvent.reject(Error('account broadcaster must be the main payee'));
            }

            if (_expectedAmounts.filter((amount) => amount.isNeg()).length !== 0) {
                return promiEvent.reject(Error('_expectedAmounts must be positives integer'));
            }

            if (!this.web3Single.isAddressNoChecksum(_payer)) {
                return promiEvent.reject(Error('_payer must be a valid eth address'));
            }
            if (!this.isArrayOfBitcoinAddresses(_payerRefundAddress)) {
                return promiEvent.reject(Error('_payerRefundAddress must be valid eth addresses'));
            }

            if (_extension) {
                return promiEvent.reject(Error('extensions are disabled for now'));
            }

            if ( this.web3Single.areSameAddressesNoChecksum(account, _payer) ) {
                return promiEvent.reject(Error('_from must be different than _payer'));
            }
            // get the amount to collect
            try {

                const collectEstimation = await this.instanceRequestBitcoinOfflineLast.methods.collectEstimation(expectedAmountsTotal).call();

                _options.value = collectEstimation;

                // add file to ipfs
                const hashIpfs = await this.ipfs.addFile(_data);

                const method = this.instanceRequestBitcoinOfflineLast.methods.createRequestAsPayeeAction(
                    _payeesIdAddress,
                    this.createBytesForPaymentAddress(_payeesPaymentAddress),
                    _expectedAmounts,
                    _payer,
                    this.createBytesForPaymentAddress(_payerRefundAddress),
                    hashIpfs);

                // submit transaction
                this.web3Single.broadcastMethod(
                    method,
                    (hash: string) => {
                        return promiEvent.eventEmitter.emit('broadcasted', {transaction: {hash}});
                    },
                    (receipt: any) => {
                        // we do nothing here!
                    },
                    async (confirmationNumber: number, receipt: any) => {
                        if (confirmationNumber === _options.numberOfConfirmation) {
                            const eventRaw = receipt.events[0];
                            const event = this.web3Single.decodeEvent(this.abiRequestCoreLast, 'Created', eventRaw);
                            try {
                                const requestAfter = await this.getRequest(event.requestId);
                                promiEvent.resolve({request: requestAfter, transaction: {hash: receipt.transactionHash}});
                            } catch (e) {
                                return promiEvent.reject(e);
                            }
                        }
                    },
                    (errBroadcast) => {
                        return promiEvent.reject(errBroadcast);
                    },
                    _options);
            } catch (e) {
                promiEvent.reject(e);
            }
        });
        return promiEvent.eventEmitter;
    }

    /**
     * sign a request as payee
     * @param   _payeesIdAddress           ID addresses of the payees (the position 0 will be the main payee, must be the broadcaster address)
     * @param   _expectedAmounts           amount initial expected per payees for the request
     * @param   _expirationDate            timestamp in second of the date after which the signed request is not broadcastable
     * @param   _payeesPaymentAddress      payment addresses of the payees (the position 0 will be the main payee) (optional)
     * @param   _data                      Json of the request's details (optional)
     * @param   _extension                 address of the extension contract of the request (optional) NOT USED YET
     * @param   _extensionParams           array of parameters for the extension (optional) NOT USED YET
     * @param   _from                      address of the payee, default account will be used otherwise (optional)
     * @return  promise of the object containing the request signed
     */
 /*   public signRequestAsPayee(
        _payeesIdAddress: string[],
        _expectedAmounts: any[],
        _expirationDate: number,
        _payeesPaymentAddress ?: Array<string|undefined>,
        _data ?: string,
        _extension ?: string,
        _extensionParams ?: any[],
        _from ?: string,
        ): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();

        _expectedAmounts = _expectedAmounts.map((amount) => new BN(amount));

        let payeesPaymentAddressParsed: string[] = [];
        if (_payeesPaymentAddress) {
            payeesPaymentAddressParsed = _payeesPaymentAddress.map((addr) => addr ? addr : EMPTY_BYTES_20);
        }

        this.web3Single.getDefaultAccountCallback(async (err, defaultAccount) => {
            if (!_from && err) return promiEvent.reject(err);
            const account: string = _from || defaultAccount || '';

            if (_payeesIdAddress.length !== _expectedAmounts.length) {
                return promiEvent.reject(Error('_payeesIdAddress and _expectedAmounts must have the same size'));
            }
            if (_payeesPaymentAddress && _payeesIdAddress.length < _payeesPaymentAddress.length) {
                return promiEvent.reject(Error('_payeesPaymentAddress cannot be bigger than _payeesIdAddress'));
            }

            const todaySolidityTime: number = (new Date().getTime()) / 1000;
            if ( _expirationDate <= todaySolidityTime ) {
                return promiEvent.reject(Error('_expirationDate must be greater than now'));
            }

            if (_expectedAmounts.filter((amount) => amount.isNeg()).length !== 0) {
                return promiEvent.reject(Error('_expectedAmounts must be positives integer'));
            }
            if ( !this.web3Single.areSameAddressesNoChecksum(account, _payeesIdAddress[0]) ) {
                return promiEvent.reject(Error('account broadcaster must be the main payee'));
            }
            if (!this.web3Single.isArrayOfAddressesNoChecksum(_payeesIdAddress)) {
                return promiEvent.reject(Error('_payeesIdAddress must be valid eth addresses'));
            }
            if (!this.web3Single.isArrayOfAddressesNoChecksum(payeesPaymentAddressParsed)) {
                return promiEvent.reject(Error('_payeesPaymentAddress must be valid eth addresses'));
            }
            if (_extension) {
                return promiEvent.reject(Error('extensions are disabled for now'));
            }

            try {
                // add file to ipfs
                const hashIpfs = await this.ipfs.addFile(_data);

                const signedRequest = await this.createSignedRequest(
                                this.addressRequestBitcoinOfflineLast,
                                _payeesIdAddress,
                                _expectedAmounts,
                                payeesPaymentAddressParsed,
                                _expirationDate,
                                hashIpfs,
                                '',
                                []);

                promiEvent.resolve(signedRequest);
            } catch (e) {
                promiEvent.reject(e);
            }
        });
        return promiEvent.eventEmitter;
    }*/

    /**
     * broadcast a signed transaction and fill it with his address as payer
     * @dev emit the event 'broadcasted' with {transaction: {hash}} when the transaction is submitted
     * @param   _signedRequest     object signed request
     * @param   _amountsToPay      amounts to pay in wei for each payee (optional)
     * @param   _additionals       amounts of additional in wei for each payee (optional)
     * @param   _options           options for the method (gasPrice, gas, value, from, numberOfConfirmation)
     * @return  promise of the object containing the request and the transaction hash ({request, transactionHash})
     */
/*    public broadcastSignedRequestAsPayer(
        _signedRequest: any,
        _amountsToPay ?: any[],
        _additionals ?: any[],
        _options ?: any,
        ): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();

        let amountsToPayParsed: any[] = [];
        if (_amountsToPay) {
            amountsToPayParsed = _amountsToPay.map((amount) => new BN(amount || 0));
        }
        let additionalsParsed: any[] = [];
        if (_additionals) {
            additionalsParsed = _additionals.map((amount) => new BN(amount || 0));
        }
        const amountsToPayTotal = amountsToPayParsed.reduce((a, b) => a.add(b), new BN(0));

        _signedRequest.expectedAmounts = _signedRequest.expectedAmounts.map((amount: any) => new BN(amount));
        const expectedAmountsTotal = _signedRequest.expectedAmounts.reduce((a: any, b: any) => a.add(b), new BN(0));

        if (_signedRequest.payeesPaymentAddress) {
            _signedRequest.payeesPaymentAddress = _signedRequest.payeesPaymentAddress.map((addr: any) => addr ? addr : EMPTY_BYTES_20);
        } else {
            _signedRequest.payeesPaymentAddress = [];
        }

        _signedRequest.data = _signedRequest.data ? _signedRequest.data : '';
        _options = this.web3Single.setUpOptions(_options);

        this.web3Single.getDefaultAccountCallback(async (err, defaultAccount) => {
            if (!_options.from && err) return promiEvent.reject(err);
            const account = _options.from || defaultAccount;
            const error = this.isSignedRequestHasError(_signedRequest, account);
            if (error !== '') return promiEvent.reject(Error(error));

            if (_amountsToPay && _signedRequest.payeesIdAddress.length < _amountsToPay.length) {
                return promiEvent.reject(Error('_amountsToPay cannot be bigger than _payeesIdAddress'));
            }
            if (_additionals && _signedRequest.payeesIdAddress.length < _additionals.length) {
                return promiEvent.reject(Error('_additionals cannot be bigger than _payeesIdAddress'));
            }
            if (amountsToPayParsed.filter((amount) => amount.isNeg()).length !== 0) {
                return promiEvent.reject(Error('_amountsToPay must be positives integer'));
            }
            if (additionalsParsed.filter((amount) => amount.isNeg()).length !== 0) {
                return promiEvent.reject(Error('_additionals must be positives integer'));
            }
            if (this.web3Single.areSameAddressesNoChecksum(account, _signedRequest.payeesIdAddress[0]) ) {
                return promiEvent.reject(Error('_from must be different than the main payee'));
            }
            if (_signedRequest.extension) {
                return promiEvent.reject(Error('extensions are disabled for now'));
            }

            try {
                // get the amount to collect
                const collectEstimation = await this.instanceRequestBitcoinOfflineLast.methods.collectEstimation(expectedAmountsTotal).call();

                _options.value = amountsToPayTotal.add(new BN(collectEstimation));

                const method = this.instanceRequestBitcoinOfflineLast.methods.broadcastSignedRequestAsPayer(
                                                    this.requestCoreServices.createBytesRequest(_signedRequest.payeesIdAddress, _signedRequest.expectedAmounts, 0, _signedRequest.data),
                                                    _signedRequest.payeesPaymentAddress,
                                                    amountsToPayParsed,
                                                    additionalsParsed,
                                                    _signedRequest.expirationDate,
                                                    _signedRequest.signature);

                // submit transaction
                this.web3Single.broadcastMethod(
                    method,
                    (hash: string) => {
                        return promiEvent.eventEmitter.emit('broadcasted', {transaction: {hash}});
                    },
                    (receipt: any) => {
                        // we do nothing here!
                    },
                    async (confirmationNumber: number, receipt: any) => {
                        if (confirmationNumber === _options.numberOfConfirmation) {
                            const eventRaw = receipt.events[0];
                            const event = this.web3Single.decodeEvent(this.abiRequestCoreLast, 'Created', eventRaw);
                            try {
                                const requestAfter = await this.getRequest(event.requestId);
                                promiEvent.resolve({request: requestAfter, transaction: {hash: receipt.transactionHash}});
                            } catch (e) {
                                return promiEvent.reject(e);
                            }
                        }
                    },
                    (errBroadcast) => {
                        return promiEvent.reject(errBroadcast);
                    },
                    _options);
            } catch (e) {
                promiEvent.reject(e);
            }
        });
        return promiEvent.eventEmitter;
    }
*/

    /**
     * accept a request as payer
     * @dev emit the event 'broadcasted' with {transaction: {hash}} when the transaction is submitted
     * @param   _requestId         requestId of the payer
     * @param   _options           options for the method (gasPrice, gas, value, from, numberOfConfirmation)
     * @return  promise of the object containing the request and the transaction hash ({request, transactionHash})
     */
    public accept(
        _requestId: string,
        _options ?: any): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();
        _options = this.web3Single.setUpOptions(_options);

        this.web3Single.getDefaultAccountCallback(async (err, defaultAccount) => {
            if (!_options.from && err) return promiEvent.reject(err);
            const account = _options.from || defaultAccount;

            try {
                const request = await this.getRequest(_requestId);

                if (request.state !== Types.State.Created) {
                    return promiEvent.reject(Error('request state is not \'created\''));
                }
                if (!this.web3Single.areSameAddressesNoChecksum(account, request.payer) ) {
                    return promiEvent.reject(Error('account must be the payer'));
                }

                const contract = this.web3Single.getContractInstance(request.currencyContract.address);
                const method = contract.instance.methods.accept(_requestId);

                this.web3Single.broadcastMethod(
                    method,
                    (hash: string) => {
                        return promiEvent.eventEmitter.emit('broadcasted', {transaction: {hash}});
                    },
                    (receipt: any) => {
                        // we do nothing here!
                    },
                    async (confirmationNumber: number, receipt: any) => {
                        if (confirmationNumber === _options.numberOfConfirmation) {
                            const eventRaw = receipt.events[0];
                            const coreContract = this.requestCoreServices.getCoreContractFromRequestId(request.requestId);
                            const event = this.web3Single.decodeEvent(coreContract.abi, 'Accepted', eventRaw);
                            try {
                                const requestAfter = await this.getRequest(event.requestId);
                                promiEvent.resolve({request: requestAfter, transaction: {hash: receipt.transactionHash}});
                            } catch (e) {
                                return promiEvent.reject(e);
                            }
                        }
                    },
                    (error: Error) => {
                        return promiEvent.reject(error);
                    },
                    _options);
            } catch (e) {
                promiEvent.reject(e);
            }
        });

        return promiEvent.eventEmitter;
    }

    /**
     * cancel a request as payer or payee
     * @dev emit the event 'broadcasted' with {transaction: {hash}} when the transaction is submitted
     * @param   _requestId         requestId of the payer
     * @param   _options           options for the method (gasPrice, gas, value, from, numberOfConfirmation)
     * @return  promise of the object containing the request and the transaction hash ({request, transactionHash})
     */
    public cancel(
        _requestId: string,
        _options ?: any): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();
        _options = this.web3Single.setUpOptions(_options);

        this.web3Single.getDefaultAccountCallback( async (err, defaultAccount) => {
            if (!_options.from && err) return promiEvent.reject(err);
            const account = _options.from || defaultAccount;

            try {
                const request = await this.getRequest(_requestId);

                if ( !this.web3Single.areSameAddressesNoChecksum(account, request.payer)
                        && !this.web3Single.areSameAddressesNoChecksum(account, request.payee.address) ) {
                    return promiEvent.reject(Error('account must be the payer or the payee'));
                }
                if ( this.web3Single.areSameAddressesNoChecksum(account, request.payer)
                        && request.state !== Types.State.Created ) {
                    return promiEvent.reject(Error('payer can cancel request in state \'created\''));
                }
                if ( this.web3Single.areSameAddressesNoChecksum(account, request.payee.address)
                        && request.state === Types.State.Canceled ) {
                    return promiEvent.reject(Error('payee cannot cancel request already canceled'));
                }

                let balanceTotal = request.payee.balance;
                for (const subPayee of request.subPayees) {
                   balanceTotal = balanceTotal.add(subPayee.balance);
                }

                if ( !balanceTotal.isZero() ) {
                    return promiEvent.reject(Error('impossible to cancel a Request with a balance !== 0'));
                }

                const contract = this.web3Single.getContractInstance(request.currencyContract.address);
                const method = contract.instance.methods.cancel(_requestId);

                this.web3Single.broadcastMethod(
                    method,
                    (hash: string) => {
                        return promiEvent.eventEmitter.emit('broadcasted', {transaction: {hash}});
                    },
                    (receipt: any) => {
                        // we do nothing here!
                    },
                    async (confirmationNumber: number, receipt: any) => {
                        if (confirmationNumber === _options.numberOfConfirmation) {
                            const eventRaw = receipt.events[0];
                            const coreContract = this.requestCoreServices.getCoreContractFromRequestId(request.requestId);
                            const event = this.web3Single.decodeEvent(coreContract.abi, 'Canceled', eventRaw);
                            try {
                                const requestAfter = await this.getRequest(event.requestId);
                                promiEvent.resolve({request: requestAfter, transaction: {hash: receipt.transactionHash}});
                            } catch (e) {
                                return promiEvent.reject(e);
                            }
                        }
                    },
                    (error: Error) => {
                        return promiEvent.reject(error);
                    },
                    _options);
            } catch (e) {
                promiEvent.reject(e);
            }
        });

        return promiEvent.eventEmitter;
    }

    /**
     * add subtracts to a request as payee
     * @dev emit the event 'broadcasted' with {transaction: {hash}} when the transaction is submitted
     * @param   _requestId         requestId of the payer
     * @param   _subtracts         amounts of subtracts in wei for each payee
     * @param   _options           options for the method (gasPrice, gas, value, from, numberOfConfirmation)
     * @return  promise of the object containing the request and the transaction hash ({request, transactionHash})
     */
    public subtractAction(
        _requestId: string,
        _subtracts: any[],
        _options ?: any): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();
        _options = this.web3Single.setUpOptions(_options);

        let subtractsParsed: any[] = [];
        if (_subtracts) {
            subtractsParsed = _subtracts.map((amount) => new BN(amount || 0));
        }

        this.web3Single.getDefaultAccountCallback(async (err, defaultAccount) => {
            if (!_options.from && err) return promiEvent.reject(err);
            const account = _options.from || defaultAccount;

            try {
                const request = await this.getRequest(_requestId);

                if (_subtracts && request.subPayees.length + 1 < _subtracts.length) {
                    return promiEvent.reject(Error('_subtracts cannot be bigger than _payeesIdAddress'));
                }
                if (subtractsParsed.filter((amount) => amount.isNeg()).length !== 0) {
                    return promiEvent.reject(Error('subtracts must be positives integer'));
                }
                if ( request.state === Types.State.Canceled ) {
                    return promiEvent.reject(Error('request must be accepted or created'));
                }
                if ( !this.web3Single.areSameAddressesNoChecksum(account, request.payee.address) ) {
                    return promiEvent.reject(Error('account must be payee'));
                }
                if (request.payee.expectedAmount.lt(subtractsParsed[0])) {
                    return promiEvent.reject(Error('subtracts must be lower than amountExpected\'s'));
                }
                let subtractTooHigh = false;
                let subtractsTooLong = false;
                for (const k in subtractsParsed) {
                    if (k === '0') continue;
                    if (!request.subPayees.hasOwnProperty(parseInt(k, 10) - 1)) {
                        subtractsTooLong = true;
                        break;
                    }
                    if (request.subPayees[parseInt(k, 10) - 1].expectedAmount.lt(subtractsParsed[k])) {
                        subtractTooHigh = true;
                        break;
                    }
                }
                if (subtractsTooLong) {
                    return promiEvent.reject(Error('subtracts size must be lower than number of payees'));
                }
                if (subtractTooHigh) {
                    return promiEvent.reject(Error('subtracts must be lower than amountExpected\'s'));
                }

                const contract = this.web3Single.getContractInstance(request.currencyContract.address);
                const method = contract.instance.methods.subtractAction(_requestId, subtractsParsed);

                this.web3Single.broadcastMethod(
                    method,
                    (hash: string) => {
                        return promiEvent.eventEmitter.emit('broadcasted', {transaction: {hash}});
                    },
                    (receipt: any) => {
                        // we do nothing here!
                    },
                    async (confirmationNumber: number, receipt: any) => {
                        if (confirmationNumber === _options.numberOfConfirmation) {
                            const coreContract = this.requestCoreServices.getCoreContractFromRequestId(request.requestId);
                            const event = this.web3Single.decodeEvent(coreContract.abi,
                                                                        'UpdateExpectedAmount',
                                                                        receipt.events[0]);
                            try {
                                const requestAfter = await this.getRequest(event.requestId);
                                promiEvent.resolve({request: requestAfter, transaction: {hash: receipt.transactionHash}});
                            } catch (e) {
                                return promiEvent.reject(e);
                            }
                        }
                    },
                    (error: Error) => {
                        return promiEvent.reject(error);
                    },
                    _options);
            } catch (e) {
                promiEvent.reject(e);
            }
        });

        return promiEvent.eventEmitter;
    }

    /**
     * add additionals to a request as payer
     * @dev emit the event 'broadcasted' with {transaction: {hash}} when the transaction is submitted
     * @param   _requestId         requestId of the payer
     * @param   _additionals       amounts of additionals in wei for each payee
     * @param   _options           options for the method (gasPrice, gas, value, from, numberOfConfirmation)
     * @return  promise of the object containing the request and the transaction hash ({request, transactionHash})
     */
    public additionalAction(
        _requestId: string,
        _additionals: any[],
        _options ?: any): Web3PromiEvent {
        const promiEvent = Web3PromiEvent();
        _options = this.web3Single.setUpOptions(_options);

        let additionalsParsed: any[] = [];
        if (_additionals) {
            additionalsParsed = _additionals.map((amount) => new BN(amount || 0));
        }

        this.web3Single.getDefaultAccountCallback(async (err, defaultAccount) => {
            if (!_options.from && err) return promiEvent.reject(err);
            const account = _options.from || defaultAccount;

            try {
                const request = await this.getRequest(_requestId);

                if (_additionals && request.subPayees.length + 1 < _additionals.length) {
                    return promiEvent.reject(Error('_additionals cannot be bigger than _payeesIdAddress'));
                }
                if (additionalsParsed.filter((amount) => amount.isNeg()).length !== 0) {
                    return promiEvent.reject(Error('additionals must be positives integer'));
                }
                if ( request.state === Types.State.Canceled ) {
                    return promiEvent.reject(Error('request must be accepted or created'));
                }
                if ( !this.web3Single.areSameAddressesNoChecksum(account, request.payer) ) {
                    return promiEvent.reject(Error('account must be payer'));
                }

                let subtractsTooLong = false;
                for (const k in additionalsParsed) {
                    if (k === '0') continue;
                    if (!request.subPayees.hasOwnProperty(parseInt(k, 10) - 1)) {
                        subtractsTooLong = true;
                        break;
                    }
                }
                if (subtractsTooLong) {
                    return promiEvent.reject(Error('additionals size must be lower than number of payees'));
                }

                const contract = this.web3Single.getContractInstance(request.currencyContract.address);
                const method = contract.instance.methods.additionalAction(_requestId, additionalsParsed);

                this.web3Single.broadcastMethod(
                    method,
                    (hash: string) => {
                        return promiEvent.eventEmitter.emit('broadcasted', {transaction: {hash}});
                    },
                    (receipt: any) => {
                        // we do nothing here!
                    },
                    async (confirmationNumber: number, receipt: any) => {
                        if (confirmationNumber === _options.numberOfConfirmation) {
                            const eventRaw = receipt.events[0];
                            const coreContract = this.requestCoreServices.getCoreContractFromRequestId(request.requestId);
                            const event = this.web3Single.decodeEvent(coreContract.abi,
                                                                        'UpdateExpectedAmount',
                                                                        eventRaw);
                            try {
                                const requestAfter = await this.getRequest(event.requestId);
                                promiEvent.resolve({request: requestAfter, transaction: {hash: receipt.transactionHash}});
                            } catch (e) {
                                return promiEvent.reject(e);
                            }
                        }
                    },
                    (error: Error) => {
                        return promiEvent.reject(error);
                    },
                    _options);
            } catch (e) {
                promiEvent.reject(e);
            }
        });

        return promiEvent.eventEmitter;
    }

    /**
     * Get info from currency contract (generic method)
     * @dev return {} always
     * @param   _requestId    requestId of the request
     * @return  promise of the information from the currency contract of the request (always {} here)
     */
    public getRequestCurrencyContractInfo(
        requestData: any,
        coreContract: any): Promise < any > {
        return new Promise(async (resolve, reject) => {
            try {
                const currencyContract = this.web3Single.getContractInstance(requestData.currencyContract);

                // get payee payment bitcoin address
                const payeePaymentAddress: string = await currencyContract.instance.methods.payeesPaymentAddress(requestData.requestId, 0).call();

                // get subPayees payment addresses
                const subPayeesCount = requestData.subPayees.length;
                const subPayeesPaymentAddress: string[] = [];
                for (let i = 0; i < subPayeesCount; i++) {
                    const paymentAddress = await currencyContract.instance.methods.payeesPaymentAddress(requestData.requestId, i + 1).call();
                    subPayeesPaymentAddress.push(paymentAddress);
                }

                // get payee Refund bitcoin Address
                const payeeRefundAddress: string = await currencyContract.instance.methods.payerRefundAddress(requestData.requestId, 0).call();

                // get subPayees refund bitcoin addresses
                const subPayeesRefundAddress: string[] = [];
                for (let i = 0; i < subPayeesCount; i++) {
                    const refundAddress = await currencyContract.instance.methods.payerRefundAddress(requestData.requestId, i + 1).call();
                    subPayeesRefundAddress.push(refundAddress);
                }

                const allPayees: string[] = [payeePaymentAddress].concat(subPayeesPaymentAddress);
                const allPayeesRefund: string[] = [payeeRefundAddress].concat(subPayeesRefundAddress);

                // get all payement on the payees addresses
                const dataPayments = await this.bitcoinService.getMultiAddress(allPayees);

                const balance: any = {};
                for (const tx of dataPayments.txs) {
                    for (const o of tx.out) {
                        if (allPayees.indexOf(o.addr) !== -1) {
                            if (!balance[o.addr]) {
                                balance[o.addr] = new BN(0);
                            }
                            balance[o.addr] = balance[o.addr].add(new BN(o.value));
                        }
                    }
                }

                // get all refund on the payees refund addresses
                const dataRefunds = await this.bitcoinService.getMultiAddress(allPayeesRefund);

                const balanceRefund: any = {};
                for (const tx of dataPayments.txs) {
                    for (const o of tx.out) {
                        if (allPayeesRefund.indexOf(o.addr) !== -1) {
                            if (!balanceRefund[o.addr]) {
                                balanceRefund[o.addr] = new BN(0);
                            }
                            balanceRefund[o.addr] = balanceRefund[o.addr].add(new BN(o.value));
                        }
                    }
                }

                let paymentTemp: any;
                let refundTemp: any;

                // update balance of subPayees objects
                for (let i = 0; i < subPayeesCount; i++) {
                    paymentTemp = new BN(balance[subPayeesPaymentAddress[i]]);
                    refundTemp = new BN(balanceRefund[subPayeesRefundAddress[i]]);
                    requestData.subPayees[i].balance = paymentTemp.sub(refundTemp);
                }
                // update balance of payee object
                paymentTemp = new BN(balance[payeePaymentAddress]);
                refundTemp = new BN(balanceRefund[payeeRefundAddress]);
                requestData.payee.balance = paymentTemp.sub(refundTemp);

                requestData.currencyContract = {payeePaymentAddress, subPayeesPaymentAddress, payeeRefundAddress, subPayeesRefundAddress, address: requestData.currencyContract};

                return resolve(requestData);
            } catch (e) {
                return reject(e);
            }
        });
    }

    /**
     * alias of requestCoreServices.getRequest()
     */
    public getRequest(_requestId: string): Promise < any > {
        return this.requestCoreServices.getRequest(_requestId);
    }

    /**
     * alias of requestCoreServices.getRequestEvents()
     */
    public getRequestEvents(
        _requestId: string,
        _fromBlock ?: number,
        _toBlock ?: number): Promise < any > {
        return this.requestCoreServices.getRequestEvents(_requestId, _fromBlock, _toBlock);
    }

    /**
     * decode data from input tx (generic method)
     * @param   _data    requestId of the request
     * @return  return an object with the name of the function and the parameters
     */
    public decodeInputData(_address: string, _data: any): any {
        const contract = this.web3Single.getContractInstance(_address);
        return this.web3Single.decodeInputData(contract.abi, _data);
    }

    /**
     * generate web3 method of the contract from name and parameters in array (generic method)
     * @param   _data    requestId of the request
     * @return  return a web3 method object
     */
    public generateWeb3Method(_address: string, _name: string, _parameters: any[]): any {
        const contract = this.web3Single.getContractInstance(_address);
        return this.web3Single.generateWeb3Method(contract.instance, _name, _parameters);
    }

    /**
     * check if a signed request is valid
     * @param   _signedRequest    Signed request
     * @param   _payer             Payer of the request
     * @return  return a string with the error, or ''
     */
/*    public isSignedRequestHasError(_signedRequest: any, _payer: string): string {
        _signedRequest.expectedAmounts = _signedRequest.expectedAmounts.map((amount: any) => new BN(amount));

        if (_signedRequest.payeesPaymentAddress) {
            _signedRequest.payeesPaymentAddress = _signedRequest.payeesPaymentAddress.map((addr: any) => addr ? addr : EMPTY_BYTES_20);
        } else {
            _signedRequest.payeesPaymentAddress = [];
        }

        const hashComputed = this.hashRequest(
                        _signedRequest.currencyContract,
                        _signedRequest.payeesIdAddress,
                        _signedRequest.expectedAmounts,
                        '',
                        _signedRequest.payeesPaymentAddress,
                        _signedRequest.data ? _signedRequest.data : '',
                        _signedRequest.expirationDate);

        if (!_signedRequest) {
            return '_signedRequest must be defined';
        }
        // some controls on the arrays
        if (_signedRequest.payeesIdAddress.length !== _signedRequest.expectedAmounts.length) {
            return '_payeesIdAddress and _expectedAmounts must have the same size';
        }

        if (_signedRequest.expectedAmounts.filter((amount: any) => amount.isNeg()).length !== 0) {
            return '_expectedAmounts must be positives integer';
        }
        if (!this.web3Single.areSameAddressesNoChecksum(this.addressRequestBitcoinOfflineLast, _signedRequest.currencyContract)) {
            return 'currencyContract must be the last currencyContract of requestBitcoinOffline';
        }
        if (_signedRequest.expirationDate < (new Date().getTime()) / 1000) {
            return 'expirationDate must be greater than now';
        }
        if (hashComputed !== _signedRequest.hash) {
            return 'hash is not valid';
        }
        if (!this.web3Single.isArrayOfAddressesNoChecksum(_signedRequest.payeesIdAddress)) {
            return 'payeesIdAddress must be valid eth addresses';
        }
        if (!this.web3Single.isArrayOfAddressesNoChecksum(_signedRequest.payeesPaymentAddress)) {
            return 'payeesPaymentAddress must be valid eth addresses';
        }
        if (this.web3Single.areSameAddressesNoChecksum(_payer, _signedRequest.payeesIdAddress[0])) {
            return '_from must be different than main payee';
        }
        if (!this.web3Single.isValidSignatureForSolidity(_signedRequest.signature, _signedRequest.hash, _signedRequest.payeesIdAddress[0])) {
            return 'payee is not the signer';
        }
        return '';
    }
*/
    /**
     * Get request events from currency contract (generic method)
     * @param   _requestId    requestId of the request
     * @param   _fromBlock    search events from this block (optional)
     * @param   _toBlock    search events until this block (optional)
     * @return  promise of the object containing the events from the currency contract of the request (always {} here)
     */
    public async getRequestEventsCurrencyContractInfo(
        _request: any,
        _coreContract: any,
        _fromBlock ?: number,
        _toBlock ?: number): Promise < any > {
        try {
            const currencyContract = this.web3Single.getContractInstance(_request.currencyContract);

            // payee payment address
            const payeePaymentAddress: string = await currencyContract.instance.methods.payeesPaymentAddress(_request.requestId, 0).call();
            // get subPayees payment addresses
            const subPayeesCount = await _coreContract.instance.methods.getSubPayeesCount(_request.requestId).call();
            const subPayeesPaymentAddress: string[] = [];
            for (let i = 0; i < subPayeesCount; i++) {
                const paymentAddress = await currencyContract.instance.methods.payeesPaymentAddress(_request.requestId, i + 1).call();
                subPayeesPaymentAddress.push(paymentAddress);
            }

            // payee refund address
            const payerRefundAddress: string = await currencyContract.instance.methods.payerRefundAddress(_request.requestId, 0).call();
            // get subPayees refund addresses
            const subPayeesRefundAddress: string[] = [];
            for (let i = 0; i < subPayeesCount; i++) {
                const refundAddress = await currencyContract.instance.methods.payerRefundAddress(_request.requestId, i + 1).call();
                subPayeesRefundAddress.push(refundAddress);
            }

            const allPayees: string[] = [payeePaymentAddress].concat(subPayeesPaymentAddress);
            const allPayeesRefund: string[] = [payerRefundAddress].concat(subPayeesRefundAddress);

            // get all payment on the payees addresses
            const dataPayments = await this.bitcoinService.getMultiAddress(allPayees);
            // get all refund on the payees addresses
            const dataRefunds = await this.bitcoinService.getMultiAddress(allPayeesRefund);

            const eventPayments: any[] = [];
            for (const tx of dataPayments.txs) {
                for (const o of tx.out) {
                    if (allPayees.indexOf(o.addr) !== -1) {
                        eventPayments.push({ _meta: { hash: tx.hash, blockNumber: tx.block_height, timestamp: tx.time},
                                                data: {
                                                    0: _request.requestId,
                                                    1: allPayees.indexOf(o.addr),
                                                    2: new BN(o.value),
                                                    requestId: _request.requestId,
                                                    payeeIndex: allPayees.indexOf(o.addr),
                                                    deltaAmount: new BN(o.value),
                                                },
                                                name: 'UpdateBalance'});
                    }
                }
            }

            const eventRefunds: any[] = [];
            for (const tx of dataPayments.txs) {
                for (const o of tx.out) {
                    if (allPayeesRefund.indexOf(o.addr) !== -1) {
                        eventRefunds.push({ _meta: { hash: tx.hash, blockNumber: tx.block_height, timestamp: tx.time},
                                                data: {
                                                    0: _request.requestId,
                                                    1: allPayeesRefund.indexOf(o.addr),
                                                    2: new BN(-o.value),
                                                    requestId: _request.requestId,
                                                    payeeIndex: allPayeesRefund.indexOf(o.addr),
                                                    deltaAmount: new BN(-o.value),
                                                },
                                                name: 'UpdateBalance'});
                    }
                }
            }

            return Promise.resolve(eventRefunds.concat(eventPayments));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    /**
     * internal create the object signed request
     * @param   currencyContract          Address of the ethereum currency contract
     * @param   payeesIdAddress           ID addresses of the payees (the position 0 will be the main payee, must be the signer address)
     * @param   expectedAmounts           amount initial expected per payees for the request
     * @param   payeesPaymentAddress      payment addresses of the payees (the position 0 will be the main payee)
     * @param   expirationDate            timestamp in second of the date after which the signed request is not broadcastable
     * @param   data                      Json of the request's details (optional)
     * @param   extension                 address of the extension contract of the request (optional) NOT USED YET
     * @param   extensionParams           array of parameters for the extension (optional) NOT USED YET
     * @return  promise of the object containing the request signed
     */
/*    private async createSignedRequest(
        currencyContract: string,
        payeesIdAddress: string[],
        expectedAmounts: any[],
        payeesPaymentAddress: Array<string|undefined>,
        expirationDate: number,
        data ?: string,
        extension ?: string,
        extensionParams ?: any[]): Promise<any> {

        const hash = this.hashRequest(currencyContract,
                                        payeesIdAddress,
                                        expectedAmounts,
                                        '',
                                        payeesPaymentAddress,
                                        data ? data : '',
                                        expirationDate);

        const signature = await this.web3Single.sign(hash, payeesIdAddress[0]);

        extension = extension ? extension : undefined;
        extensionParams = extension ? extensionParams : undefined;
        data = data ? data : undefined;

        for (const k in expectedAmounts) {
            if (expectedAmounts.hasOwnProperty(k)) {
                expectedAmounts[k] = expectedAmounts[k].toString();
            }
        }

        for (const k in payeesPaymentAddress) {
            if (payeesPaymentAddress.hasOwnProperty(k)) {
                payeesPaymentAddress[k] = payeesPaymentAddress[k] === EMPTY_BYTES_20 ? undefined : payeesPaymentAddress[k];
            }
        }

        return {currencyContract,
                data,
                expectedAmounts,
                expirationDate,
                extension,
                extensionParams,
                hash,
                payeesIdAddress,
                payeesPaymentAddress,
                signature};
    }
*/
    /**
     * internal compute the hash of the request
     * @param   currencyContract          Address of the ethereum currency contract
     * @param   payees                    ID addresses of the payees (the position 0 will be the main payee, must be the signer address)
     * @param   expectedAmounts           amount initial expected per payees for the request
     * @param   payer                     payer of the request
     * @param   payeesPaymentAddress      payment addresses of the payees (the position 0 will be the main payee)
     * @param   data                      Json of the request's details (optional)
     * @param   expirationDate            timestamp in second of the date after which the signed request is not broadcastable
     * @return  promise of the object containing the request's hash
     */
/*    private hashRequest(currencyContract: string,
                        payees: string[],
                        expectedAmounts: any[],
                        payer: string,
                        payeesPayment: any[],
                        data: string,
                        expirationDate: number): any {
        interface InterfaceAbi {
            value: any;
            type: string;
        }

        const requestParts: InterfaceAbi[] = [
            {value: currencyContract, type: 'address'},
            {value: payees[0], type: 'address'},
            {value: payer, type: 'address'},
            {value: payees.length, type: 'uint8'}];

        for (const k in payees) {
            if (payees.hasOwnProperty(k)) {
                requestParts.push({value: payees[k], type: 'address'});
                requestParts.push({value: expectedAmounts[k], type: 'int256'});
            }
        }

        requestParts.push({value: data.length, type: 'uint8'});
        requestParts.push({value: data, type: 'string'});

        requestParts.push({value: payeesPayment, type: 'address[]'});
        requestParts.push({value: expirationDate, type: 'uint256'});

        const types: any[] = [];
        const values: any[] = [];
        requestParts.forEach((o, i) => {
            types.push(o.type);
            values.push(o.value);
        });

        return this.web3Single.web3.utils.bytesToHex(ETH_ABI.soliditySHA3(types, values));
    }*/

    /**
     * Check if an bitcoin address is valid
     * @param    _address   address to check
     * @return   true if address is valid
     */
    public isBitcoinAddress(_address: string): boolean {
        if (!_address) return false;
        return walletAddressValidator.validate(_address, 'bitcoin', 'both');
    }

    /**
     * Check if an array contains only bitcoin addresses valid
     * @param    _array   array to check
     * @return   true if array contains only bitcoin addresses valid
     */
    public isArrayOfBitcoinAddresses(_array: string[]): boolean {
        if (!_array) return false;
        return _array.filter((addr) => !this.isBitcoinAddress(addr)).length === 0;
    }

    /**
     * create a bytes request
     * @param   payeesPaymentAddress           bitcoin addresses of the payees
     * @return  the request in bytes
     */
    private createBytesForPaymentAddress(_payeesPaymentAddress: string[]): any {
        const requestParts = [];

        for (const k in _payeesPaymentAddress) {
            if (_payeesPaymentAddress.hasOwnProperty(k)) {
                requestParts.push({value: _payeesPaymentAddress[k].length, type: 'uint8'});
                requestParts.push({value: _payeesPaymentAddress[k], type: 'string'});
            }
        }

        const types: string[] = [];
        const values: any[] = [];
        requestParts.forEach((o) => {
            types.push(o.type);
            values.push(o.value);
        });

        return this.web3Single.web3.utils.bytesToHex(ETH_ABI.solidityPack(types, values));
    }
}