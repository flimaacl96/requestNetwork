// Core
import RequestCoreService from '../src/servicesCore/requestCore-service';

// Contract
import RequestEthereumService from '../src/servicesContracts/requestEthereum-service';

// Synchrone Extension

import Ipfs from './servicesExternal/ipfs-service';
import { Web3Single } from './servicesExternal/web3-single';

/**
 * The RequestNetwork class is the single entry-point into the requestNetwork.js library.
 * It contains all of the library's functionality and all calls to the library 
 * should be made through a RequestNetwork instance.
 */
export class RequestNetwork {
    /* 
     * RequestEthereum service containing methods for interacting with the Ethereum currency contract
     */
    public requestEthereumService!: RequestEthereumService;

    /* 
     * RequestCore service containing methods for interacting with the Request Core
     */
    public requestCoreService!: RequestCoreService;

    /**
     * Constructor.
     * @param {object=} options
     * @param {object=} options.provider - The Web3.js Provider instance you would like the requestNetwork.js library to use
     *  for interacting with the Ethereum network.
     * @param {number=} options.networkId - the Ethereum network ID.
     * @param {boolean=} options.useIpfsPublic - use public ipfs node if true, private one specified in “src/config.json ipfs.nodeUrlDefault.private” otherwise (default : true)
     * @return {object} An instance of the requestNetwork.js RequestNetwork class.
     */
    constructor({ provider, networkId, useIpfsPublic = true }: { provider?: any, networkId?: number, useIpfsPublic?: boolean }) {
        if (provider && ! networkId) {
            throw new Error('if you give provider you have to give the networkId too');
        }

        // init web3 wrapper singleton
        Web3Single.init(provider, networkId);

        // init ipfs wrapper singleton
        Ipfs.init(useIpfsPublic);

        // init interface services
        this.requestCoreService = new RequestCoreService();
        this.requestEthereumService = new RequestEthereumService();
    }

    public Request = class Request {
        constructor(
            as: RequestNetwork.Role,
            currency: RequestNetwork.Currency,
            payees: Array<object>,
            payer: object
        ) {
            console.log(as);
        }
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
    expectedAmount: number,
}

interface Payer {
    idAddress: string,
    refundAddress: string,
}
