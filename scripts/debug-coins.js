
const axios = require('axios');

async function check() {
  const address = "0xcad18bc68f2f890a21fdfbec9e6c7c72985a223e95a19d667881ea9fceba3f4b";
  const url = `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`;
  
  try {
    const response = await axios.get(url);
    const resources = response.data;
    resources.forEach(r => {
        if (r.type.toLowerCase().includes('coin') || r.type.toLowerCase().includes('store')) {
            console.log("MATCH:", r.type);
            console.log("DATA:", JSON.stringify(r.data, null, 2));
        }
    });
    if (resources.length > 0) {
        console.log("TOTAL RESOURCES:", resources.length);
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

check();
