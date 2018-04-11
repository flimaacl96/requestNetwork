// Core -------------------------------------
import RequestCoreService from '../src/servicesCore/requestCore-service';

// Contract ---------------------------------
import RequestBitcoinOfflineService from './servicesContracts/requestBitcoinOffline-service';
import RequestERC20Service from '../src/servicesContracts/requestERC20-service';
import RequestEthereumService from '../src/servicesContracts/requestEthereum-service';

import BitcoinService from './servicesExternal/bitcoin-service';
import Ipfs from './servicesExternal/ipfs-service';
import Web3Single from './servicesExternal/web3-single';

/**
 * The RequestNetwork class is the single entry-point into the requestNetwork.js library.
 * It contains all of the library's functionality
 * and all calls to the library should be made through a RequestNetwork instance.
 */
export default class RequestNetwork {
    /**
     * requestEthereumService class containing methods for interacting with the Ethereum currency contract
     */
    public requestEthereumService: RequestEthereumService;
    /**
     * requestERC20Service class containing methods for interacting with the ERC20 currencies contract
     */
    public requestERC20Service: RequestERC20Service;

    /**
     * requestEthereumService class containing methods for interacting with the Ethereum currency contract
     */
    public requestBitcoinOfflineService: RequestBitcoinOfflineService;

    /**
     * requestCoreService class containing methods for interacting with the Request Core
     */
    public requestCoreService: RequestCoreService;
    /**
     * new RequestNetwork instance that provides the public interface to requestNetwork.js
     * @param   provider        The Web3.js Provider instance you would like the requestNetwork.js library to use
     *                          for interacting with the Ethereum network.
     * @param   networkId       the Ethereum network ID.
     * @param   useIpfsPublic   use public ipfs node if true, private one specified in “src/config.json ipfs.nodeUrlDefault.private” otherwise (default : true)
     * @return  An instance of the requestNetwork.js RequestNetwork class.
     */
    constructor(provider?: any, networkId?: number, useIpfsPublic: boolean = true, bitcoinNetworkId?: number) {
        if (provider && ! networkId) {
            throw Error('if you give provider you have to give the networkId too');
        }
        // init web3 wrapper singleton
        Web3Single.init(provider, networkId);
        // init ipfs wrapper singleton
        Ipfs.init(useIpfsPublic);
        // init bitcoin wrapper singleton
        BitcoinService.init(bitcoinNetworkId);

        // init interface services
        this.requestCoreService = new RequestCoreService();
        this.requestEthereumService = new RequestEthereumService();
        this.requestERC20Service = new RequestERC20Service();
        this.requestBitcoinOfflineService = new RequestBitcoinOfflineService();
    }
}
