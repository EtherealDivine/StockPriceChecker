"use strict";
const express = require("express");
const mongoose = require("mongoose");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

module.exports = function (app) {
  let uri = process.env.MONGO_URI;
  console.log("Connecting to MongoDB with URI:", uri);

  mongoose
    .connect(uri)
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.log("MongoDB connection error:", err));

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
        console.log(`Finding or updating stock: ${stockName}`);
        let stockDocument = await Stock.findOneAndUpdate(
          { name: stockName },
          documentUpdate,
          { new: true, upsert: true },
        );
        console.log(`Stock document for ${stockName}:`, stockDocument);
        return stockDocument;
      } catch (error) {
        console.log(error);
        return null;
      }
    };

    /* Like Stock */
    const likeStock = async (stockName, ip) => {
      console.log(`Liking stock: ${stockName} from IP: ${ip}`);
      let stockDocument = await Stock.findOne({ name: stockName });

      if (stockDocument && stockDocument.ips.includes(ip)) {
        console.log(`IP ${ip} has already liked stock ${stockName}`);
        return stockDocument; // Return the document without incrementing likes
      }

      let documentUpdate = { $inc: { likes: 1 }, $addToSet: { ips: ip } };
      return await findOrUpdateStock(stockName, documentUpdate);
    };

    /* Get Price */
    const getPrice = async (stockName) => {
      return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        console.log(`Fetching price for stock: ${stockName}`);
        xhr.open(
          "GET",
          `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockName}/quote`,
          true,
        );
        xhr.onload = function () {
          if (xhr.status === 200) {
            let data = JSON.parse(xhr.responseText);
            console.log(`Price for ${stockName}:`, data.latestPrice);
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
        console.log(`Processing stock: ${stockName}`);
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

      console.log("Response object:", responseObject);
      return res.json(responseObject);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
};
