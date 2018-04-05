import { RequestNetwork } from '../../src/requestNetwork';
import {expect} from 'chai';
const Web3 = require('web3');

// Same function to test creation as payer and payee to ensure consistent API
async function testCreation(role: RequestNetwork.Role) {
    const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
    const accounts = await web3.eth.getAccounts();

    const requestNetwork = new RequestNetwork({
        provider: 'http://localhost:8545',
        networkId: 10000000000
    });

    const { request } = await requestNetwork.createRequest(
        role,
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
    expect(request.creator).to.equal(role);
    expect(request.currency).to.equal(RequestNetwork.Currency.Ethereum);
    expect(request.payees.length).to.equal(1);
    expect(request.payees[0].idAddress).to.equal(accounts[0]);
    expect(request.payees[0].expectedAmount).to.equal(100);
    expect(request.payer.idAddress).to.equal(accounts[1]);
}

describe('Request Network API', () => {
    it('can be created with default parameters', async () => {
       const requestNetwork = new RequestNetwork();
       expect(requestNetwork).to.exist;
    });

    it('creates a ETH request from payee', async () => {
        testCreation(RequestNetwork.Role.Payee);
    });

    it('creates a ETH request from payer', async () => {
        testCreation(RequestNetwork.Role.Payer);
    });

    it('allows to pay an ETH request', async () => {
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

        await request.pay([1]);

        expect(request.payees[0].expectedAmount.toNumber()).to.equal(100);
        expect(request.payees[0].balance.toNumber()).to.equal(1);
    });
});
