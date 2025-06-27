const express = require("express");
const router = express.Router();

const ParameterController = require("../controllers/ParameterController");

router.get("/create", ParameterController.createParameterGet);

module.exports = router;
