
const axios = require('axios');

async function check(network) {
  const address = "0xcad18bc68f2f890a21fdfbec9e6c7c72985a223e95a19d667881ea9fceba3f4b";
  const url = `https://fullnode.${network}.aptoslabs.com/v1/accounts/${address}/resources`;
  
  console.log(`Checking ${network}...`);
  try {
    const response = await axios.get(url);
    const resources = response.data;
    const coinStore = resources.find(r => r.type.includes("CoinStore") && r.type.includes("AptosCoin"));
    if (coinStore) {
        console.log(`${network} CoinStore Data:`, coinStore.data.coin.value);
    } else {
        console.log(`${network} CoinStore not found`);
    }
  } catch (e) {
    console.log(`${network} Error:`, e.response?.status);
  }
}

async function main() {
    await check('mainnet');
    await check('testnet');
    await check('devnet');
}

main();
