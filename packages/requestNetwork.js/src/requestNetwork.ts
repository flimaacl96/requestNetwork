import Ipfs from './servicesExternal/ipfs-service';
import { Web3Single } from './servicesExternal/web3-single';
import RequestCoreService from '../src/servicesCore/requestCore-service';
import currencyContracts from './currencyContracts';
import RequestEthereumService from './servicesContracts/requestEthereum-service';

const BN = require('bn.js');
const Web3PromiEvent = require('web3-core-promievent');

// RequestCore service containing methods for interacting with the Request Core
let requestCoreService: RequestCoreService;

// RequestEthereum service containing methods for interacting with the Ethereum currency contract
let requestEthereumService: RequestEthereumService; 

function serviceForCurrency(currency: RequestNetwork.Currency) {
    return {
        [RequestNetwork.Currency.Ethereum as number]: requestEthereumService,
    }[currency];
}

function promiEventLibraryWrap(request: RequestNetwork.Request, callback: Function, events: string[] = ['broadcasted']) : typeof Web3PromiEvent {
    const promiEvent = Web3PromiEvent();
    let promise = callback();

    promise.then(({ transaction } : { transaction: object }) => 
        promiEvent.resolve({ request, transaction })
    );

    events.forEach(eventName =>
        promise.on(eventName, (param: any) => promiEvent.eventEmitter.emit(eventName, param))
    );

    return promiEvent.eventEmitter;
}

/**
 * The RequestNetwork class is the single entry-point into the requestNetwork.js library.
 * It contains all of the library's functionality and all calls to the library 
 * should be made through a RequestNetwork instance.
 */
class RequestNetwork {
    /**
     * requestCoreService instance to interact directly with the core of the library.
     */
    public requestCoreService: RequestCoreService;

    /**
     * requestEthereumService instance to interact directly with the core of the library.
     */
    public requestEthereumService: RequestEthereumService;

    /**
     * Constructor.
     * @param {object=} options
     * @param {object=} options.provider - The Web3.js Provider instance you would like the requestNetwork.js library to use
     *  for interacting with the Ethereum network.
     * @param {number=} options.networkId - the Ethereum network ID.
     * @param {boolean=} options.useIpfsPublic - use public ipfs node if true, private one specified in “src/config.json ipfs.nodeUrlDefault.private” otherwise (default : true)
     * @return {object} An instance of the requestNetwork.js RequestNetwork class.
     */
    constructor(options?: any, networkId?: number, useIpfsPublic?: boolean) {
        let provider = options;
        if (typeof options === 'object') {
            provider = options.provider;
            networkId = options.networkId;
            useIpfsPublic = options.useIpfsPublic;
        }

        if (provider && ! networkId) {
            throw new Error('if you give provider you have to give the networkId too');
        }

        // init web3 wrapper singleton
        Web3Single.init(provider, networkId);

        // init ipfs wrapper singleton
        Ipfs.init(useIpfsPublic);

        requestCoreService = new RequestCoreService();
        requestEthereumService = new RequestEthereumService();

        this.requestCoreService = requestCoreService;
        this.requestEthereumService = requestEthereumService;
    }

    // Async factory function
    createRequest(
        as: RequestNetwork.Role,
        currency: RequestNetwork.Currency,
        payees: Payee[],
        payer: Payer
    ): typeof Web3PromiEvent {
        if (currency !== RequestNetwork.Currency.Ethereum) {
            throw new Error('Currency not implemented');
        }
        
        const requestEthereumService = serviceForCurrency(RequestNetwork.Currency.Ethereum);
        const promiEvent = Web3PromiEvent();
        let promise;

        if (as === RequestNetwork.Role.Payee) {
            promise = requestEthereumService.createRequestAsPayee(
                payees.map(payee => payee.idAddress),
                payees.map(payee => payee.expectedAmount),
                payer.idAddress,
                payees.map(payee => payee.paymentAddress),
                payer.refundAddress,
            );
        }

        if (as === RequestNetwork.Role.Payer) {
            promise = requestEthereumService.createRequestAsPayer(
                payees.map(payee => payee.idAddress),
                payees.map(payee => payee.expectedAmount),
                payer.refundAddress,
                undefined, // TODO: _amountsToPay - amount paid with the creation
                undefined, // _additionals
                undefined, // _data
                undefined, // _extension
                undefined, // _extensionParams
                { from: payer.idAddress }
            );
        }

        promise.then(({ request, transaction } : { request: any, transaction: object }) => {
            return promiEvent.resolve({
                request: new RequestNetwork.Request(request.requestId, currency),
                transaction,
            });
        });

        promise.on('broadcasted', (param: any) => promiEvent.eventEmitter.emit('broadcasted', param));

        return promiEvent.eventEmitter;
    }

    async fromRequestId(requestId: string) {
        const requestData = await requestCoreService.getRequest(requestId);
        const currency: RequestNetwork.Currency = currencyContracts.currencyFromContractAddress(requestData.currencyContract.address);
        return new RequestNetwork.Request(requestId, currency);
    }
    
    async createSignedRequest(
        as: RequestNetwork.Role,
        currency: RequestNetwork.Currency,
        payees: Payee[],
        expirationDate: number
    ): Promise<RequestNetwork.SignedRequest> {
        if (currency !== RequestNetwork.Currency.Ethereum) {
            throw new Error('Currency not implemented');
        }
        if (as !== RequestNetwork.Role.Payee) {
            throw new Error('Role not implemented');
        }
        
        const requestEthereumService = serviceForCurrency(RequestNetwork.Currency.Ethereum);

        const signedRequestData = await requestEthereumService.signRequestAsPayee(
            payees.map(payee => payee.idAddress),
            payees.map(payee => payee.expectedAmount),
            expirationDate,
            payees.map(payee => payee.paymentAddress)
        );

        return new RequestNetwork.SignedRequest(signedRequestData);
    }

    broadcastSignedRequest(signedRequest: RequestNetwork.SignedRequest, payer: Payer): typeof Web3PromiEvent {
        if (payer.refundAddress && payer.idAddress !== payer.refundAddress) {
            throw new Error('Different idAddress and paymentAddress for Payer of signed request not yet supported');
        }
        
        const currency: RequestNetwork.Currency = currencyContracts.currencyFromContractAddress(
            signedRequest.signedRequestData.currencyContract
        );
        
        if (currency !== RequestNetwork.Currency.Ethereum) {
            throw new Error('Currency not implemented');
        }

        const requestEthereumService = serviceForCurrency(RequestNetwork.Currency.Ethereum);

        const promiEvent = Web3PromiEvent();
        let promise = requestEthereumService.broadcastSignedRequestAsPayer(
            signedRequest.signedRequestData,
            [], // _amountsToPay
            undefined, // _additionals
            { from: payer.idAddress }
        );

        promise.then(({ request, transaction } : { request: any, transaction: object }) => {
            return promiEvent.resolve({
                request: new RequestNetwork.Request(request.requestId, currency),
                transaction,
            });
        });

        promise.on('broadcasted', (param: any) => promiEvent.eventEmitter.emit('broadcasted', param));

        return promiEvent.eventEmitter;
    }
}

namespace RequestNetwork {      
    export class Request {
        public requestId: string
        public currency: RequestNetwork.Currency
        private service: any

        constructor(requestId: string, currency: RequestNetwork.Currency) {
            this.requestId = requestId;
            this.currency = currency;

            this.service =  serviceForCurrency(currency);
        }

        pay(amountsToPay: number[] = [], additionals: number[] = []): typeof Web3PromiEvent {
            return promiEventLibraryWrap(this, () => 
                this.service.paymentAction(
                    this.requestId,
                    amountsToPay,
                    additionals
                )
            )
        }

        public cancel() : typeof Web3PromiEvent {
            return promiEventLibraryWrap(this, () => 
                this.service.cancel(this.requestId)
            )
        }

        public refund(amountToRefund: number) : typeof Web3PromiEvent {
            return promiEventLibraryWrap(this, () => 
                this.service.refundAction(this.requestId, amountToRefund)
            )
        }

        // public subtractAction(subtracts) : typeof Web3PromiEvent {
        //     subtractAction(this.requestId, subtracts)
        // }
        // public additionalAction(additionals) : typeof Web3PromiEvent {
        //     additionalAction(this.requestId, additionals)
        // }

        async getData() : Promise<RequestData> {
            return requestCoreService.getRequest(this.requestId);
        }    

        getEvents(fromBlock?: number, toBlock?: number) : Promise<Event[]> {
            return requestCoreService.getRequestEvents(this.requestId, fromBlock, toBlock)
        }    
    }    

    export class SignedRequest{
        public signedRequestData: SignedRequestData
        
        constructor(signedRequest: SignedRequestData|string) {
            this.signedRequestData = typeof signedRequest === 'string' ? 
                this.deserializeForUri(signedRequest) :
                signedRequest;
        }
        
        public getInvalidErrorMessage(payer: Payer): string {
            if (payer.refundAddress && payer.idAddress !== payer.refundAddress) {
                throw new Error('Different idAddress and paymentAddress for Payer of signed request not yet supported');
            }

            const currency: RequestNetwork.Currency = currencyContracts.currencyFromContractAddress(
                this.signedRequestData.currencyContract
            );
            
            if (currency !== RequestNetwork.Currency.Ethereum) {
                throw new Error('Currency not implemented');
            }

            const requestEthereumService = serviceForCurrency(RequestNetwork.Currency.Ethereum);

            return requestEthereumService.isSignedRequestHasError(this.signedRequestData, payer.idAddress);
        }

        isValid(payer: Payer): boolean {
            return this.getInvalidErrorMessage(payer) === '';
        }

        serializeForUri(): string {
            return JSON.stringify(this.signedRequestData);
        }
        
        private deserializeForUri(serializedRequest: string): SignedRequestData {
            return JSON.parse(serializedRequest);
        }
    }
    export enum Role {
        Payer,
        Payee,
    }

    export enum Currency {
        Ethereum,
        ERC20,
    }

    export enum State {
        Created,
        Accepted, 
        Canceled
    }
}

interface Payee {
    idAddress: string,
    paymentAddress: string,
    expectedAmount: number | any,
    balance?: number | any,
}

interface Payer {
    idAddress: string,
    refundAddress?: string,
}

interface RequestData {
    creator: RequestNetwork.Role,
    currencyContract: object,
    data: any,
    payee: Payee,
    payer: Payer,
    requestId: string,
    state: RequestNetwork.State,
    subPayees: Payee[]
}

interface SignedRequestData {
    currencyContract: string,
    data: string,
    expectedAmounts: number[],
    expirationDate: number,
    extension: string,
    extensionParams: any[],
    hash: string,
    payeesIdAddress: string,
    payeesPaymentAddress: string[],
    signature: string,
}

interface Event {
    _meta: { blockNumber: number, logIndex: number, timestamp: number },
    data: any,
    name: string,
}


export default RequestNetwork;

