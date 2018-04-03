import { RequestNetwork } from '../../src/requestNetwork';

describe('tries', () => {
    it('tries', async () => {
        const requestNetwork = new RequestNetwork({});
        
        const request = await new requestNetwork.Request(
            RequestNetwork.Role.Payee,
            RequestNetwork.Currency.Ethereum,
            [{
                idAddress: '0x01',
                paymentAddress: '0x02',
                expectedAmount: 1.43,
            }],
            {
                idAddress: '0x03',
                refundAddress: '0x04',
            }
        );
    });
});
