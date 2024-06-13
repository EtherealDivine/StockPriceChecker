"use strict";
const express = require("express");
const mongoose = require("mongoose");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

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
    responseObject["stockData"] = [];

    /* Find/Update Stock Document */
    const findOrUpdateStock = async (stockName, documentUpdate) => {
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
    const likeStock = async (stockName, ip) => {
      let documentUpdate = { $inc: { likes: 1 }, $addToSet: { ips: ip } };
      return await findOrUpdateStock(stockName, documentUpdate);
    };

    /* Get Price */
    const getPrice = async (stockName) => {
      return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(
          "GET",
          `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockName}/quote`,
          true,
        );
        xhr.onload = function () {
          if (xhr.status === 200) {
            let data = JSON.parse(xhr.responseText);
            resolve(data.latestPrice); // Assuming 'latestPrice' contains the stock price
          } else {
            reject(`Error fetching price for ${stockName}: ${xhr.statusText}`);
          }
        };
        xhr.onerror = function () {
          reject(`Error fetching price for ${stockName}: ${xhr.statusText}`);
        };
        xhr.send();
      });
    };

    /* Process Input */
    try {
      let stockNames = Array.isArray(req.query.stock)
        ? req.query.stock
        : [req.query.stock];
      let stockDocuments = [];

      for (let stockName of stockNames) {
        let stockDocument;
        if (req.query.like === "true") {
          stockDocument = await likeStock(stockName, req.ip);
        } else {
          stockDocument = await findOrUpdateStock(stockName, {});
        }

        if (stockDocument) {
          stockDocument.price = await getPrice(stockName);
          stockDocuments.push(stockDocument);
        }
      }

      if (stockDocuments.length === 1) {
        responseObject["stockData"] = {
          stock: stockDocuments[0].name,
          price: stockDocuments[0].price,
          likes: stockDocuments[0].likes,
        };
      } else if (stockDocuments.length === 2) {
        let rel_likes1 = stockDocuments[0].likes - stockDocuments[1].likes;
        let rel_likes2 = stockDocuments[1].likes - stockDocuments[0].likes;

        responseObject["stockData"] = stockDocuments.map((doc, index) => ({
          stock: doc.name,
          price: doc.price,
          rel_likes: index === 0 ? rel_likes1 : rel_likes2,
        }));
      }

      return res.json(responseObject);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
};
