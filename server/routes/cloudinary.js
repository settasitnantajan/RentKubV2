const express = require("express");
const router = express.Router();

const { authCheck } = require("../middlewares/auth");
const { createImages } = require("../controllers/cloudinary");

router.post("/images", authCheck, createImages);

module.exports = router;
