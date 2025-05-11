const express = require("express");
const router = express.Router();
// controller
const {
  createReview,

} = require("../controllers/review");
const { authCheck } = require("../middlewares/auth");

router.post("/reviews", authCheck,createReview);


module.exports = router;