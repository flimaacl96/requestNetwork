import { RequestNetwork } from '../../src/requestNetwork';
import {expect} from 'chai';
const Web3 = require('web3');

describe('Request Network API', () => {
    it('can be created with default parameters', async () => {
       const requestNetwork = new RequestNetwork();
       expect(requestNetwork, 'data.asPayee is wrong').to.exist;
    });

    it('creates a ETH request from payee', async () => {
        const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
        const accounts = await web3.eth.getAccounts();

        const requestNetwork = new RequestNetwork({
            provider: 'http://localhost:8545',
            networkId: 10000000000
        });

        const { request } = await requestNetwork.createRequest(
            RequestNetwork.Role.Payee,
            RequestNetwork.Currency.Ethereum,
            [{
                idAddress: accounts[0],
                paymentAddress: accounts[0],
                expectedAmount: 100,
            }],
            {
                idAddress: accounts[1],
                refundAddress: accounts[1],
            }
        );

        expect(request.requestId).to.exist;
        expect(request.creator).to.equal(RequestNetwork.Role.Payee);
        expect(request.currency).to.equal(RequestNetwork.Currency.Ethereum);
        expect(request.payees.length).to.equal(1);
        expect(request.payees[0].idAddress).to.equal(accounts[0]);
        expect(request.payees[0].expectedAmount).to.equal(100);
        expect(request.payer.idAddress).to.equal(accounts[1]);
    });
});
