import requestArtifacts from 'requestnetworkartifacts';
import { Request, RequestNetwork } from './requestNetwork';

const currencyMapping: any = {
    'RequestEthereum': RequestNetwork.Currency.Ethereum
}

export default {
    currencyFromContractAddress(address: string) {
        const currencyContractName = requestArtifacts.getContractNameForAddress(address.toLowerCase());
        return currencyMapping[currencyContractName];
    }
}
