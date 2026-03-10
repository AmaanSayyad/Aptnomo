
const axios = require('axios');

async function check() {
  const address = "0xcad18bc68f2f890a21fdfbec9e6c7c72985a223e95a19d667881ea9fceba3f4b";
  const url = `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`;
  
  try {
    const response = await axios.get(url);
    console.log("Status:", response.status);
    const resources = response.data;
    console.log("Resources:", JSON.stringify(resources.map(r => r.type), null, 2));
    const coinStore = resources.find(r => r.type.includes("CoinStore") && r.type.includes("AptosCoin"));
    if (coinStore) {
        console.log("CoinStore Data:", JSON.stringify(coinStore.data, null, 2));
    } else {
        console.log("CoinStore not found in resources");
    }
  } catch (e) {
    console.log("Error:", e.response?.status, e.response?.data || e.message);
  }
}

check();
