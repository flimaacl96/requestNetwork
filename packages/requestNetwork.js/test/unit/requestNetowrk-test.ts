import { RequestNetwork } from '../../src/requestNetwork';
const Web3 = require('web3');

describe('Request Network API', () => {
    it('creates a ETH request from payee', async () => {
        const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

        const accounts = await web3.eth.getAccounts();

        const requestNetwork = new RequestNetwork({
            provider: 'http://localhost:8545',
            networkId: 10000000000
        });
        
        const request = await new requestNetwork.Request(
            RequestNetwork.Role.Payee,
            RequestNetwork.Currency.Ethereum,
            [{
                idAddress: accounts[0].toLowerCase(),
                paymentAddress: accounts[0].toLowerCase(),
                expectedAmount: 1.43,
            }],
            {
                idAddress: accounts[1].toLowerCase(),
                refundAddress: accounts[1].toLowerCase(),
            }
        );

        debugger;
    });
});
