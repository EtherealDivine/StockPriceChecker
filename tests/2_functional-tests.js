const chaiHttp = require("chai-http");
const chai = require("chai");
const assert = chai.assert;
const server = require("../server");

chai.use(chaiHttp);

suite("Functional Tests", function () {
  test("GET /api/stock-prices with one stock", function (done) {
    chai
      .request(server)
      .get("/api/stock-prices")
      .query({ stock: "GOOG" })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, "stockData");
        assert.property(res.body.stockData, "stock");
        assert.property(res.body.stockData, "price");
        assert.property(res.body.stockData, "likes");
        done();
      });
  });

  test("GET /api/stock-prices with one stock and like", function (done) {
    chai
      .request(server)
      .get("/api/stock-prices")
      .query({ stock: "GOOG", like: "true" })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, "stockData");
        assert.property(res.body.stockData, "stock");
        assert.property(res.body.stockData, "price");
        assert.property(res.body.stockData, "likes");
        done();
      });
  });

  test("GET /api/stock-prices with two stocks", function (done) {
    chai
      .request(server)
      .get("/api/stock-prices")
      .query({ stock: ["GOOG", "MSFT"] })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, "stockData");
        assert.isArray(res.body.stockData);
        assert.lengthOf(res.body.stockData, 2);
        res.body.stockData.forEach((stock) => {
          assert.property(stock, "stock");
          assert.property(stock, "price");
          assert.property(stock, "rel_likes");
        });
        done();
      });
  });

  // Ensure likes are only counted once per IP
  test("Ensure likes are only counted once per IP", function (done) {
    chai
      .request(server)
      .get("/api/stock-prices")
      .query({ stock: "GOOG", like: "true" })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        let initialLikes = res.body.stockData.likes;

        chai
          .request(server)
          .get("/api/stock-prices")
          .query({ stock: "GOOG", like: "true" })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.body.stockData.likes, initialLikes); // likes should not increase
            done();
          });
      });
  });

  // Compare likes between two stocks
  test("Compare likes between two stocks", function (done) {
    chai
      .request(server)
      .get("/api/stock-prices")
      .query({ stock: ["GOOG", "MSFT"] })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, "stockData");
        assert.isArray(res.body.stockData);
        assert.lengthOf(res.body.stockData, 2);
        res.body.stockData.forEach((stock) => {
          assert.property(stock, "stock");
          assert.property(stock, "price");
          assert.property(stock, "rel_likes");
        });
        done();
      });
  });
});
