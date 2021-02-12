require('dotenv').config();
const ccxt = require('ccxt');
const axios = require("axios");
const fs = require('fs');

let content = '';



const tick = async (config, binanceClient) => {
  const { asset, base, spread, allocation } = config;
  const market = `${asset}/${base}`;

  // Cancel open orders left from previou tick, if any
  const orders = await binanceClient.fetchOpenOrders(market);
  orders.forEach(async order => {
    await binanceClient.cancelOrder(order.id, order.symbol);
  });

  // Fetch current market prices
  const results = await Promise.all([
    axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
    axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd')
  ]);
  const marketPrice = results[0].data.bitcoin.usd / results[1].data.tether.usd;

  // Calculate new orders parameters
  const sellPrice = marketPrice * (1 + spread);
  const buyPrice = marketPrice * (1 - spread);
  const balances = await binanceClient.fetchBalance();
  const assetBalance = balances.free[asset]; // e.g. 0.01 BTC
  const baseBalance = balances.free[base]; // e.g. 20 USDT
  const sellVolume = assetBalance * allocation;
  const buyVolume = (baseBalance * allocation) / marketPrice;

  //Send orders
  await binanceClient.createLimitSellOrder(market, sellVolume, sellPrice);
  await binanceClient.createLimitBuyOrder(market, buyVolume, buyPrice);

  console.log( "\x1b[32m",`
    New tick for ${market}...
    Created limit sell order for ${sellVolume}@${sellPrice}  
    Created limit buy order for ${buyVolume}@${buyPrice}  
  `);

  content = `${assetBalance} BTC\t${baseBalance} USDT\n`;

  fs.writeFile('balance.txt', content, { flag: 'a+' }, err => {
    console.log("\x1b[31m","Could not write to file","\x1b[0m");
  })


//   fs.appendFile('my_files/balance.txt', content, {flag: "w+"}, err => { 
//   if (err) {
//     console.log("\x1b[31m", err);
//     return
//   }
//   //file written successfully
//   console.log("\x1b[32m", "Written to file");
// })
  console.log(`Current balance: \n${assetBalance} BTC\t${baseBalance} USDT`);
};

const run = () => {
  const config = { 
    asset: "BTC",
    base: "USDT",
    allocation: 0.8,     // Percentage of our available funds that we trade
    spread: 0.01,         // Percentage above and below market prices for sell and buy orders 
    tickInterval: 2000  // Duration between each tick, in milliseconds
  };
  const binanceClient = new ccxt.binance({
    apiKey: process.env.API_KEY,
    secret: process.env.API_SECRET
  });
  tick(config, binanceClient);
  setInterval(tick, config.tickInterval, config, binanceClient);
  
};




run();
