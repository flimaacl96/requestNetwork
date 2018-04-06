import Ipfs from './servicesExternal/ipfs-service';
import { Web3Single } from './servicesExternal/web3-single';
import RequestCoreService from '../src/servicesCore/requestCore-service';
import RequestEthereumService from '../src/servicesContracts/requestEthereum-service';

const BN = require('bn.js');
const Web3PromiEvent = require('web3-core-promievent');


// RequestCore service containing methods for interacting with the Request Core
let requestCoreService: RequestCoreService;

// RequestEthereum service containing methods for interacting with the Ethereum currency contract
let requestEthereumService: RequestEthereumService;

/**
 * The RequestNetwork class is the single entry-point into the requestNetwork.js library.
 * It contains all of the library's functionality and all calls to the library 
 * should be made through a RequestNetwork instance.
 */
export class RequestNetwork {
    /**
     * Constructor.
     * @param {object=} options
     * @param {object=} options.provider - The Web3.js Provider instance you would like the requestNetwork.js library to use
     *  for interacting with the Ethereum network.
     * @param {number=} options.networkId - the Ethereum network ID.
     * @param {boolean=} options.useIpfsPublic - use public ipfs node if true, private one specified in “src/config.json ipfs.nodeUrlDefault.private” otherwise (default : true)
     * @return {object} An instance of the requestNetwork.js RequestNetwork class.
     */
    constructor({ provider, networkId, useIpfsPublic = true }: { provider?: any, networkId?: number, useIpfsPublic?: boolean } = {}) {
        if (provider && ! networkId) {
            throw new Error('if you give provider you have to give the networkId too');
        }

        // init web3 wrapper singleton
        Web3Single.init(provider, networkId);

        // init ipfs wrapper singleton
        Ipfs.init(useIpfsPublic);

        requestCoreService = new RequestCoreService();
        requestEthereumService = new RequestEthereumService();
    }

    // Async factory function
    createRequest(
        as: RequestNetwork.Role,
        currency: RequestNetwork.Currency,
        payees: Array<Payee>,
        payer: Payer
    ): typeof Web3PromiEvent {
        const promiEvent = Web3PromiEvent();
        let promise;

        if (as === RequestNetwork.Role.Payee && currency === RequestNetwork.Currency.Ethereum) {
            promise = requestEthereumService.createRequestAsPayee(
                payees.map(payee => payee.idAddress),
                payees.map(payee => payee.expectedAmount),
                payer.idAddress,
                payees.map(payee => payee.paymentAddress),
                payer.refundAddress,
            );
        }

        if (as === RequestNetwork.Role.Payer && currency === RequestNetwork.Currency.Ethereum) {
            promise = requestEthereumService.createRequestAsPayer(
                payees.map(payee => payee.idAddress),
                payees.map(payee => payee.expectedAmount),
                payer.refundAddress,
                undefined, // _amountsToPay
                undefined, // _additionals
                undefined, // _data
                undefined, // _extension
                undefined, // _extensionParams
                { from: payer.idAddress }
            );
        }

        if (!promise) {
            throw new Error('Role-Currency Not implemented');
        }

        promise.then(({ request, transaction } : { request: any, transaction: object }) => {
            return promiEvent.resolve({
                request: new Request(request.requestId, as, currency, payees, payer),
                transaction,
            })
        });

        promise.on('broadcasted', (param: any) => promiEvent.eventEmitter.emit('broadcasted', param));

        return promiEvent.eventEmitter;
    }
}

export class Request {
    public requestId: string
    public creator: RequestNetwork.Role
    public currency: RequestNetwork.Currency
    public payees: Array<Payee>
    public payer: Payer
    
    constructor(
        requestId: string,
        creator: RequestNetwork.Role,
        currency: RequestNetwork.Currency,
        payees: Array<Payee>,
        payer: Payer,
    ) {
        this.requestId = requestId;
        this.creator = creator;
        this.currency = currency;
        this.payees = payees;
        this.payer = payer;
    }

    async pay(
        _amountsToPay: Array<number> = [],
        _additionals: Array<number> = [],
    ): Promise<{ request: Request, transaction: object }> {
        if (this.currency === RequestNetwork.Currency.Ethereum) {
            const { request, transaction } = await requestEthereumService.paymentAction(
                this.requestId,
                _amountsToPay,
                _additionals
            );
            this.payees = [request.payee, ...request.subPayees];

            return {
                transaction,
                request: this,
            };
        }
        
        throw new Error('Currency Not implemented');
    }
}

export namespace RequestNetwork {
    export enum Role {
        Payer,
        Payee,
    }

    export enum Currency {
        Ethereum,
        ERC20,
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
    refundAddress: string,
}
