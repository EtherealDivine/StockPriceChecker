"use strict";
const express = require("express");
let mongoose = require("mongoose");
let XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
let mongodb = require("mongodb");

module.exports = function (app) {
  let uri = process.env.MONGO_URI;

  mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Create a schema and model to represent the stocks.
  let stockSchema = new mongoose.Schema({
    name: { type: String, required: true },
    likes: { type: Number, default: 0 },
    ips: [String],
  });

  let Stock = mongoose.model("Stock", stockSchema);

  app.route("/api/stock-prices").get(async function (req, res) {
    let responseObject = {};
    responseObject["stockData"] = {};

    // Variable to determine number of stocks
    let twoStocks = false;

    /* Output Response */
    let outputResponse = () => {
      return res.json(responseObject);
    };

    /* Find/Update Stock Document */
    let findOrUpdateStock = async (stockName, documentUpdate) => {
      try {
        let stockDocument = await Stock.findOneAndUpdate(
          { name: stockName },
          documentUpdate,
          { new: true, upsert: true },
        );
        return stockDocument;
      } catch (error) {
        console.log(error);
        return null;
      }
    };

    /* Like Stock */
    let likeStock = async (stockName, ip) => {
      let documentUpdate = { $inc: { likes: 1 }, $addToSet: { ips: ip } };
      return await findOrUpdateStock(stockName, documentUpdate);
    };

    /* Get Price */
    let getPrice = async (stockDocument, nextStep) => {
      let stockName = stockDocument.name;
      let xhr = new XMLHttpRequest();
      xhr.open(
        "GET",
        `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockName}/quote`,
        true,
      );
      xhr.onload = function () {
        if (xhr.status === 200) {
          let data = JSON.parse(xhr.responseText);
          stockDocument.price = data.latestPrice; // Assuming 'latestPrice' contains the stock price
          nextStep(stockDocument, outputResponse);
        } else {
          console.log(
            `Error fetching price for ${stockName}: ${xhr.statusText}`,
          );
          stockDocument.price = null;
          nextStep(stockDocument, outputResponse);
        }
      };
      xhr.send();
    };

    /* Build Response for 1 Stock */
    let processOneStock = (stockDocument, nextStep) => {
      responseObject["stockData"]["stock"] = stockDocument["name"];
      responseObject["stockData"]["price"] = stockDocument["price"];
      responseObject["stockData"]["likes"] = stockDocument["likes"];
      nextStep();
    };

    /* Build Response for 2 Stocks */
    let processTwoStocks = (stockDocuments, nextStep) => {
      responseObject["stockData"] = stockDocuments.map((doc) => ({
        stock: doc.name,
        price: doc.price,
        likes: doc.likes,
      }));
      nextStep();
    };

    /* Process Input*/
    if (typeof req.query.stock === "string") {
      /* One Stock */
      let stockName = req.query.stock;
      let stockDocument;

      if (req.query.like === "true") {
        stockDocument = await likeStock(stockName, req.ip);
      } else {
        stockDocument = await findOrUpdateStock(stockName, {});
      }

      if (stockDocument) {
        getPrice(stockDocument, processOneStock);
      }
    } else if (Array.isArray(req.query.stock)) {
      twoStocks = true;
      /* Two Stocks */
      let stockNames = req.query.stock;
      let stockDocuments = [];

      for (let stockName of stockNames) {
        let stockDocument;

        if (req.query.like === "true") {
          stockDocument = await likeStock(stockName, req.ip);
        } else {
          stockDocument = await findOrUpdateStock(stockName, {});
        }

        if (stockDocument) {
          await getPrice(stockDocument, (doc) => stockDocuments.push(doc));
        }
      }

      if (stockDocuments.length === 2) {
        processTwoStocks(stockDocuments, outputResponse);
      }
    } // End of API route handler
  });
};
