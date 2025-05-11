const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/auth");
const { getHostLandmarks, getHostBookings } = require("../controllers/host");

// GET /api/host/landmarks - Fetch landmarks owned by the host
router.get("/host/landmarks", authCheck, getHostLandmarks);

// GET /api/host/bookings - Fetch bookings for the host's landmarks
router.get("/host/bookings", authCheck, getHostBookings);

module.exports = router;
