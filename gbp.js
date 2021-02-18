require('dotenv').config();
const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5000;
const ccxt = require('ccxt');
const axios = require("axios");
let marketPrice;
let results;

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

const tick = async (config, binanceClient) => {
  const { asset, base, spread, allocation } = config;
  const market = `${asset}/${base}`;

  // Cancel open orders left from previous tick, if any
  const orders = await binanceClient.fetchOpenOrders(market);
  orders.forEach(async order => {
    await binanceClient.cancelOrder(order.id, order.symbol);
  });

  // Fetch current market prices
 results = await  axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp');

  marketPrice = results.data.bitcoin.gbp;

  console.log("marketPrice:" +  marketPrice);

  // Calculate new orders parameters
  const sellPrice = marketPrice * (1.05);
  const buyPrice = marketPrice * (0.98);
  const balances = await binanceClient.fetchBalance();
  const assetBalance = balances.free[asset]; // e.g. 0.01 BTC
  const baseBalance = balances.free[base]; // e.g. 20 GBP
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

  content = `${assetBalance} BTC\t${baseBalance} GBP\n`;

  console.log(`Current balance: \n${assetBalance} BTC\t${baseBalance} GBP`);
};

const run = () => {
  const config = { 
    asset: "BTC",
    base: "GBP",
    allocation: 0.5,     // Percentage of our available funds that we trade
    // spread: 0.02,         // Percentage above and below market prices for sell and buy orders 
    tickInterval: 20000  // Duration between each tick, in milliseconds
  };
  const binanceClient = new ccxt.binance({
    apiKey: process.env.API_KEY,
    secret: process.env.API_SECRET
  });
  tick(config, binanceClient);
  setInterval(tick, config.tickInterval, config, binanceClient);
};

run();
