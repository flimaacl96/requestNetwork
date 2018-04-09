import requestArtifacts from 'requestnetworkartifacts';
import { Request, RequestNetwork } from '../src/requestNetwork';

export default {
    currencyFromContractAddress(address: string) {
        const currencyMapping: any = {
            RequestEthereum: RequestNetwork.Currency.Ethereum
        }

        const currencyContractName = requestArtifacts.getContractNameForAddress(address.toLowerCase());
        return currencyMapping[currencyContractName];
    }
}
