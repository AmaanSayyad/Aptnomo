
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

async function check() {
  const address = "0xcad18bc68f2f890a21fdfbec9e6c7c72985a223e95a19d667881ea9fceba3f4b";
  
  console.log("Checking Mainnet...");
  const mainnetConfig = new AptosConfig({ network: Network.MAINNET });
  const mainnetAptos = new Aptos(mainnetConfig);
  try {
    const resources = await mainnetAptos.getAccountResources({ accountAddress: address });
    console.log("Mainnet Resources found:", resources.length);
    const coinStore = resources.find(r => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
    console.log("Mainnet CoinStore:", JSON.stringify(coinStore?.data, null, 2));
  } catch (e) {
    console.log("Mainnet check failed:", e.message);
  }

  console.log("\nChecking Testnet...");
  const testnetConfig = new AptosConfig({ network: Network.TESTNET });
  const testnetAptos = new Aptos(testnetConfig);
  try {
    const resources = await testnetAptos.getAccountResources({ accountAddress: address });
    console.log("Testnet Resources found:", resources.length);
    const coinStore = resources.find(r => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
    console.log("Testnet CoinStore:", JSON.stringify(coinStore?.data, null, 2));
  } catch (e) {
    console.log("Testnet check failed:", e.message);
  }
}

check();
