const express = require("express");
const router = express.Router();

const {
  listCamping,
  readCamping,
  createCamping,
  updateCamping,
  deleteCamping,
  actionFavorite,
  listFavorites,
  filterCamping,
  getBookedDates, // Import the getBookedDates function
} = require("../controllers/camping");

const { authCheck } = require("../middlewares/auth");

//list
router.get("/campings/:id", listCamping);

//read param
router.get("/camping/:id", readCamping);

//post
router.post("/camping", authCheck, createCamping);

//put param
router.put("/camping/:id", authCheck, updateCamping); // Added authCheck

//delete param
router.delete("/camping/:id", authCheck, deleteCamping); // Added authCheck

//Favorite Route
router.post("/favorite", authCheck, actionFavorite);
router.get("/favorites", authCheck, listFavorites);

//Filter
router.get("/filter-camping", filterCamping);

// --- New Route for Booked Dates (Public) ---
router.get("/camping/:id/booked-dates", getBookedDates);

module.exports = router;
