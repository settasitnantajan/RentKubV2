// /Users/duke/Documents/GitHub/RentKub/server/routes/profile.js
const express = require("express");
const router = express.Router();
// controller - Import all functions
const { createProfile, getProfile, updateProfile } = require("../controllers/profile");
const { authCheck } = require("../middlewares/auth");

// POST /api/profile - Create or Update Profile (using upsert)
router.post("/profile", authCheck, createProfile);

// GET /api/profile/me - Get the current logged-in user's profile
router.get("/profile/me", authCheck, getProfile);

// --- New Route for Updating ---
// PUT /api/profile/me - Update the current logged-in user's profile
// Using PUT for updating existing resource, could also use PATCH
router.put("/profile/me", authCheck, updateProfile);
// --- End New Route ---

module.exports = router;
