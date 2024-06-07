"use strict";
const express = require("express");
let mongoose = require("mongoose");
let mongodb = require("mongodb");

module.exports = function (app) {
  let uri = process.env.MONGO_URI;

  // Removing deprecated options
  mongoose.connect(uri);

  //create a schema and model to represent the stocks.
  let stockSchema = new mongoose.Schema({
    name: { type: String, required: true },
    likes: { type: Number, default: 0 },
    ips: [String],
  });

  let Stock = mongoose.model("Stock", stockSchema);

  app.route("/api/stock-prices").get(function (req, res) {
    // Your code to handle the API route
  });
};
