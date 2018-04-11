import config from '../config';
import * as Types from '../types';

const WEB3 = require('web3');

/**
 * The BitcoinService class is the singleton class containing the web3.js interface
 */
export default class BitcoinService {
    /**
     * Initialized the class BitcoinService
     * @param   bitcoinNetworkId       the bitcoin network ID (1: main, 3: testnet)
     */
    public static init(bitcoinNetworkId ?: number) {
        this._instance = new this(bitcoinNetworkId);
    }
    /**
     * get the instance of BitcoinService
     * @return  The instance of the BitcoinService class.
     */
    public static getInstance() {
        return this._instance;
    }
    /**
     * return BN of web3
     * @return Web3.utils.BN
     */
    public static BN() {
        return WEB3.utils.BN;
    }

    private static _instance: BitcoinService;

    private bitcoinNetworkId: number = 3;

    private bitcoinBlockExplorer: any;

    /**
     * Private constructor to Instantiates a new BitcoinService
     * @param   provider        The Web3.js Provider instance you would like the requestNetwork.js
     *                          library to use for interacting with the Ethereum network.
     * @param   networkId       the Ethereum network ID.
     */
    private constructor(bitcoinNetworkId ?: number) {
        this.bitcoinNetworkId = bitcoinNetworkId || config.bitcoin.default;

        this.bitcoinBlockExplorer = require('blockchain.info/blockexplorer').usingNetwork(this.bitcoinNetworkId);
    }

    public getMultiAddress(_addresses: string[]): Promise<any> {
        return this.bitcoinBlockExplorer.getMultiAddress(_addresses);
    }

}
