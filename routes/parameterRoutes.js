const express = require("express");
const router = express.Router();

const ParameterController = require("../controllers/ParameterController");

router.get("/create", ParameterController.createParameterGet);
router.post("/create", ParameterController.createParameterPost);

router.get("/list", ParameterController.listParameters);

router.get("/edit/:id", ParameterController.editParameterGet);
router.post("/edit/:id", ParameterController.editParameterPost);

router.post("/delete", ParameterController.deleteParameter);

module.exports = router;
