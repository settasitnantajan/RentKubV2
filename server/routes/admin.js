const express = require("express");
const router = express.Router();
// controller
const {
  listStats,
  listUsers,
  listCampings,
  deleteCamping,
  listBookings,
} = require("../controllers/admin");
const { authCheck } = require("../middlewares/auth");

router.get("/stats", authCheck, listStats);

router.get("/admin/users", authCheck, listUsers);

router.get("/admin/campings", authCheck, listCampings);

router.delete("/admin/campings/:id", authCheck, deleteCamping);

router.get("/admin/bookings", authCheck, listBookings);

module.exports = router;
