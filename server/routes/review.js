const express = require("express");
const router = express.Router();
// controller
const {
  createHostReplyComment,
  createReview,
} = require("../controllers/review"); // Import the new function
const { authCheck } = require("../middlewares/auth");

// User creates a review
router.post("/reviews", authCheck, createReview);

// Host adds a reply to a review - Use the new function
router.post("/reviews/:reviewId/reply", authCheck, createHostReplyComment); // Add or uncomment this line
// The route for general comments (/comments) has been removed as per request.

module.exports = router;
