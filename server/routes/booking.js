const express = require("express");
const router = express.Router();
// controller
const {
  listBookings,
  createBooking,
  checkout,
  checkOutStatus,
  getUnavailableDates, // Import the existing function
  getBookingsByCampingId,
  updateBookingStatusByHost, // Import the new status update function
  deleteBookingByUser, // Import the new delete function
  cancelBookingByUser, // Import the new cancel function
  retryPayment,
} = require("../controllers/booking");
const { authCheck } = require("../middlewares/auth");

// api/Bookings
router.get("/bookings", authCheck, listBookings);

// api/Profile
router.post("/booking", authCheck, createBooking);

// api/booking/unavailable/:landmarkId
router.get("/booking/unavailable/:landmarkId", getUnavailableDates); // No authCheck needed? Depends on requirements.

// api/booking/by-camping/:campingId - New route
router.get("/booking/by-camping/:campingId", authCheck, getBookingsByCampingId);

// api/checkout
router.post("/checkout", authCheck, checkout);

// api/retry-payment
router.post("/retry-payment", authCheck, retryPayment);

// api/checkout-status/:session_id
router.get("/checkout-status/:session_id", authCheck, checkOutStatus);

// api/booking/:bookingId/status - New route for updating booking status by host
router.patch(
  "/booking/:bookingId/status",
  authCheck,
  updateBookingStatusByHost
);

// api/booking/:bookingId - New route for user to delete their booking
router.delete("/booking/:bookingId", authCheck, deleteBookingByUser);

// api/booking/:bookingId/cancel - New route for user to cancel their booking
router.patch("/booking/:bookingId/cancel", authCheck, cancelBookingByUser);

module.exports = router;
