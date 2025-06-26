const express = require("express");
const router = express.Router();
const multer = require("multer");

const SampleController = require("../controllers/SampleController");

router.get("/list", SampleController.listSamples1);
router.get("/:importId/list", SampleController.listSamples2);

router.post("/delete", SampleController.deleteSample);

router.get("/edit/:id", SampleController.editSampleGet);
router.post("/edit", SampleController.editSamplePost);

const upload = multer({ dest: "uploads" });
router.get("/import", SampleController.importCsvGet);
router.post(
  "/import",

  upload.single("csvFile"),
  SampleController.importCsvPost
);

router.get("/delete-import", SampleController.deleteImportGet);
router.post("/delete-import", SampleController.deleteImportPost);

router.post("/pre-classification", SampleController.selectImportPost);

router.post("/classification", SampleController.classification);

router.get("/:importId/export-csv", SampleController.exportSamples);

router.get("/chart-all-points", SampleController.chartAllPoints);
router.get("/chart-point-selection", SampleController.chartPointSelection);
router.post("/chart-batch-export", SampleController.chartBatchExport);

module.exports = router;
