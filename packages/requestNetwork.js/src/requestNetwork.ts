import Ipfs from './servicesExternal/ipfs-service';
import { Web3Single } from './servicesExternal/web3-single';
import RequestCoreService from '../src/servicesCore/requestCore-service';
import RequestEthereumService from '../src/servicesContracts/requestEthereum-service';

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
    constructor({ provider, networkId, useIpfsPublic = true }: { provider?: any, networkId?: number, useIpfsPublic?: boolean }) {
        if (provider && ! networkId) {
            throw new Error('if you give provider you have to give the networkId too');
       }
        // TODO: Sanity checks

        // init web3 wrapper singleton
        Web3Single.init(provider, networkId);

        // init ipfs wrapper singleton
        Ipfs.init(useIpfsPublic);

        requestCoreService = new RequestCoreService();
        requestEthereumService = new RequestEthereumService();
    }

    public Request = class Request {
        constructor(
            as: RequestNetwork.Role,
            currency: RequestNetwork.Currency,
            payees: Array<Payee>,
            payer: Payer
        ) {
            // TODO: Sanity checks

            if (as === RequestNetwork.Role.Payee && currency === RequestNetwork.Currency.Ethereum) {
                return requestEthereumService.createRequestAsPayee(
                    //_payeesIdAddress: string[],
                    payees.map(payee => payee.idAddress),

                    // _expectedAmounts: any[],
                    payees.map(payee => payee.expectedAmount),

                    // _payer: string,
                    payer.idAddress,

                    // _payeesPaymentAddress ?: Array<string|undefined>,
                    payees.map(payee => payee.paymentAddress),

                    // _payerRefundAddress ?: string,
                    payer.refundAddress,

                    // _data ?: string,
                    // _extension ?: string,
                    // _extensionParams ?: any[],
                    // _options ?: any
                );
            }

            throw new Error('Role-Currency Not implemented');
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
