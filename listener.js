require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const provider = new ethers.JsonRpcProvider(
  `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);

const CONTRACT_ABI = [
  "function addTrackedWallet(address wallet) external",
  "function addCexWallet(address wallet) external",
  "function reportTransaction(address from, address to, uint256 amount) external",
  "function getTrackedWallets() external view returns (address[])",
  "function getCexWallets() external view returns (address[])",
  "event SuspiciousTransaction(address indexed from, address indexed to, uint256 amount, uint256 timestamp)"
];

const wallet = new ethers.Wallet(
  `0x${process.env.PRIVATE_KEY}`,
  provider
);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  CONTRACT_ABI,
  wallet
);

const CEX_WALLETS = new Set([
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be", // Binance
  "0xd551234ae421e3bcba99a0da6d736074f22192ff", // Binance 2
  "0xa910f92acdaf488fa6ef02174fb86208ad7722ba", // Coinbase
]);

const TRACKED_WALLETS = new Set();

async function sendTelegramAlert(from, to, amount) {
  const message = `
🚨 *DEX to CEX Alert*

*From:* \`${from}\`
*To (CEX):* \`${to}\`
*Amount:* ${ethers.formatEther(amount)} ETH
*Time:* ${new Date().toUTCString()}

[View on Etherscan](https://sepolia.etherscan.io/address/${from})
  `;

  await bot.sendMessage(CHAT_ID, message, { parse_mode: "Markdown" });
  console.log("Telegram alert sent");
}

async function addWalletToTrack(address) {
  console.log(`Adding wallet to track: ${address}`);
  const tx = await contract.addTrackedWallet(address);
  await tx.wait();
  TRACKED_WALLETS.add(address.toLowerCase());
  console.log(`Wallet ${address} is now being tracked`);
}

async function loadTrackedWallets() {
  const wallets = await contract.getTrackedWallets();
  wallets.forEach(w => TRACKED_WALLETS.add(w.toLowerCase()));
  console.log(`Loaded ${wallets.length} tracked wallets`);
  console.log(`Tracking addresses:`, [...TRACKED_WALLETS]);
}

async function monitorTransactions() {
  console.log("Starting DEX monitor...");
  console.log("Listening for transactions...");

  await loadTrackedWallets();

  provider.on("block", async (blockNumber) => {
    console.log(`Scanning block ${blockNumber}`);
    
    try {
      const block = await provider.getBlock(blockNumber, true);
      
      if (!block || !block.transactions) return;

      console.log(`Block ${blockNumber} has ${block.transactions.length} transactions`);

      for (const txOrHash of block.transactions) {
        try {
          let tx;
          if (typeof txOrHash === "string") {
            tx = await provider.getTransaction(txOrHash);
          } else {
            tx = txOrHash;
          }

          if (!tx || !tx.from || !tx.to) continue;

          const from = tx.from.toLowerCase();
          const to = tx.to.toLowerCase();

          const isTracked = TRACKED_WALLETS.has(from);
          const isCex = CEX_WALLETS.has(to);

          if (isTracked) {
            console.log(`Tracked wallet activity: ${from} -> ${to} (${ethers.formatEther(tx.value)} ETH)`);
          }

          if (isTracked && isCex) {
            console.log(`Suspicious transaction detected!`);
            console.log(`From: ${tx.from}`);
            console.log(`To: ${tx.to}`);
            console.log(`Amount: ${ethers.formatEther(tx.value)} ETH`);
            await contract.reportTransaction(
  ethers.getAddress(tx.from),
  ethers.getAddress(tx.to),
  tx.value
);
            await sendTelegramAlert(tx.from, tx.to, tx.value);
          }
        } catch (txError) {
          console.error(`Error processing tx:`, txError.message);
        }
      }
    } catch (error) {
      console.error(`Error scanning block ${blockNumber}:`, error.message);
    }
  });
}

monitorTransactions().catch(console.error);