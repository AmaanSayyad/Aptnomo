
const { Aptos, AptosConfig, Network, AccountAddress } = require("@aptos-labs/ts-sdk");

async function check() {
  const addressStr = "0xcad18bc68f2f890a21fdfbec9e6c7c72985a223e95a19d667881ea9fceba3f4b";
  const normalized = AccountAddress.from(addressStr).toString();
  console.log("Original:", addressStr);
  console.log("Normalized:", normalized);
  
  const config = new AptosConfig({ network: Network.MAINNET });
  const aptos = new Aptos(config);
  
  try {
    const coin = await aptos.getAccountCoinAmount({
        accountAddress: normalized,
        coinType: "0x1::aptos_coin::AptosCoin"
    });
    console.log("Balance (Amount):", coin);
  } catch (e) {
    console.log("Error getAccountCoinAmount:", e.message);
  }
}

check();
