const Sample = require("../models/Sample");

const fs = require("fs");
const csv = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const iconv = require("iconv-lite");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const ChartDataLabels = require("chartjs-plugin-datalabels");
const archiver = require("archiver");

module.exports = class SampleController {
  static async selectImportGet(req, res) {
    const samples = await Sample.findAll();

    let importIdsArray = [];
    for (let sample of samples) {
      if (!importIdsArray.includes(sample.dataValues.importId)) {
        importIdsArray.push(sample.dataValues.importId);
      }
    }

    res.render("sample/selectImport", { importIdsArray });
  }

  static async selectImportPost(req, res) {
    const importId = req.body.importId;

    const samples = await Sample.findAll({
      raw: true,
      where: { importId: importId, ph: { [Op.gt]: 0 }, nh4: { [Op.gt]: 0 } },
    });

    res.render("sample/classification", { samples, importId });
  }

  static async listSamples1(req, res) {
    const search = req.query.search;

    let queryOptions = {
      where: {
        ...(search && {
          point: {
            [Op.like]: `%${search}%`,
          },
        }),
      },
      raw: true,
    };

    const samples = await Sample.findAll(queryOptions);

    res.render("sample/list", { samples });
  }

  static async listSamples2(req, res) {
    const importId = req.params.importId;

    const samples = await Sample.findAll({
      raw: true,
      where: { importId: importId, ph: { [Op.gt]: 0 }, nh4: { [Op.gt]: 0 } },
    });

    res.render("sample/classification", { samples, importId });
  }

  static async deleteSample(req, res) {
    await Sample.destroy({ where: { id: req.body.id } });

    res.redirect("/sample/list");
  }

  static async editSampleGet(req, res) {
    const sample = await Sample.findOne({
      raw: true,
      where: { id: req.params.id },
    });
    console.log(sample);

    res.render("sample/edit", { sample });
  }

  static async editSamplePost(req, res) {
    const id = req.body.id;

    const sample = await Sample.findOne({ raw: true, where: { id: id } });

    const variableData = {};

    for (const key in req.body) {
      variableData[key] = req.body[key];
    }

    const dateArray = variableData.date.split("-");
    variableData.date = `${dateArray[2]}/${dateArray[1]}/${dateArray[0]}`;

    sample.data = {
      ...sample.data,
      ...variableData,
    };

    await Sample.update(sample, { where: { id: id } });

    res.redirect("/sample/list");
  }

  static async importCsvGet(req, res) {
    res.render("sample/import");
  }

  static async importCsvPost(req, res) {
    if (!req.file) {
      return res.redirect("/sample/import");
    }

    const currentImportId = uuidv4();
    const groupedData = {};
    const filePath = req.file.path;

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ";" }))
      .on("data", (row) => {
        const key = `${row["Ponto"]}_${row["Data"]}`;

        if (!groupedData[key]) {
          groupedData[key] = {
            importId: currentImportId,
            point: row["Ponto"],
            date: row["Data"],
            opUnit: row["Unidade Operacional"],
            nature: row["Natureza"],
            parameters: {},
          };
        }

        groupedData[key].parameters[row["Parametro"]] = {
          value: row["Valor medido"],
          unit: row["Unidade"],
        };
      })
      .on("end", async () => {
        try {
          for (const key in groupedData) {
            const item = groupedData[key];
            const sampleData = {
              importId: currentImportId,
              point: item["point"],
              date: item["date"],
              ph: item.parameters["ph"] ? item.parameters["ph"]["value"] : null,
              nh4: item.parameters["nh4"]
                ? item.parameters["nh4"]["value"]
                : null,
              data: {
                opUnit: item["opUnit"],
                point: item["point"],
                date: item["date"],
                nature: item["nature"],
                ...item.parameters,
              },
            };

            await Sample.create(sampleData);
          }
          fs.unlinkSync(filePath);
          req.flash("message", "Dados importados com sucesso!");
          res.redirect("/sample/list");
        } catch (error) {
          console.log(error);
          fs.unlinkSync(filePath);
          res.status(500).send("Erro ao importar!");
        }
      });
  }

  static async deleteImportGet(req, res) {
    const samples = await Sample.findAll();

    let importIdsArray = [];
    for (let sample of samples) {
      if (!importIdsArray.includes(sample.dataValues.importId)) {
        importIdsArray.push(sample.dataValues.importId);
      }
    }

    res.render("sample/deleteImport", { importIdsArray });
  }

  static async deleteImportPost(req, res) {
    const importId = req.body.idSelection;

    await Sample.destroy({ where: { importId: importId } });

    res.redirect("/sample/list");
  }

  static async classification(req, res) {
    const samples = await Sample.findAll({
      raw: true,
      where: { ph: { [Op.gt]: 0 }, nh4: { [Op.gt]: 0 } },
    });

    for (const sample of samples) {
      const ph = parseFloat(sample.ph.replace(",", "."));
      const nh4 = parseFloat(sample.nh4.replace(",", "."));

      if (ph <= 7.5) {
        if (nh4 <= 3.7) {
          sample.data["conformity"] = "Conforme";
        } else {
          sample.data["conformity"] = "Não conforme";
        }
      } else if (ph > 7.5 && ph <= 8) {
        if (nh4 <= 2) {
          sample.data["conformity"] = "Conforme";
        } else {
          sample.data["conformity"] = "Não conforme";
        }
      } else if (ph > 8 && ph <= 8.5) {
        if (nh4 <= 1) {
          sample.data["conformity"] = "Conforme";
        } else {
          sample.data["conformity"] = "Não conforme";
        }
      } else {
        if (nh4 <= 0.5) {
          sample.data["conformity"] = "Conforme";
        } else {
          sample.data["conformity"] = "Não conforme";
        }
      }

      await Sample.update(sample, { where: { id: sample.id } });
    }
    res.redirect(`/sample/${samples[0].importId}/list`);
  }

  static async exportSamples(req, res) {
    const importId = req.params.importId;
    console.log(importId);

    const samplesData = await Sample.findAll({
      where: { importId: importId, ph: { [Op.gt]: 0 }, nh4: { [Op.gt]: 0 } },
    });

    const samples = samplesData.map((result) => result.get({ plain: true }));

    const csvHeaders = [
      "Ponto",
      "Data de coleta",
      "pH",
      "Nitrogênio amoniacal",
      "Conformidade",
    ];

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) {
        return "";
      }
      let strValue = String(value);
      if (
        strValue.includes(",") ||
        strValue.includes('"') ||
        strValue.includes("\n") ||
        strValue.includes("\r")
      ) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    };

    const csvRows = samples.map((sample) => {
      const point = sample.point;
      const date = sample.date;
      const ph = sample.ph;
      const nh4 = sample.nh4;
      const conformity = sample.data.conformity;

      return [
        escapeCsvValue(point),
        escapeCsvValue(date),
        escapeCsvValue(ph),
        escapeCsvValue(nh4),
        escapeCsvValue(conformity),
      ];
    });
    const csvString = [csvHeaders.join(","), ...csvRows].join("\n");
    const csvBufferLatin1 = iconv.encode(csvString, "latin1");

    res.setHeader("Content-Type", "text/csv; charset=latin1"); // Alterado para latin1
    res.setHeader("Content-Disposition", "attachment;");
    res.status(200).send(csvBufferLatin1);
  }

  static async chartAllPoints(req, res) {
    const classifiedSamples = await Sample.findAll({
      raw: true,
      where: {
        "data.conformity": { [Op.not]: null },
      },
    });

    let accordingCount = 0;
    let notAccordingCount = 0;
    let totalCount = 0;
    for (const sample of classifiedSamples) {
      if (sample.data.conformity === "Conforme") {
        accordingCount += 1;
      } else {
        notAccordingCount += 1;
      }
      totalCount += 1;
    }

    const accordingPercent = (accordingCount / totalCount) * 100;
    const notAccordingPercent = (notAccordingCount / totalCount) * 100;

    const chartData = {
      labels: ["Conforme", "Não conforme"],
      data: [accordingPercent, notAccordingPercent],
    };

    const chartDataJSON = JSON.stringify(chartData);

    res.render("sample/chartAllPoints", { chartDataJSON: chartDataJSON });
  }

  static async chartPointSelection(req, res) {
    const samples = await Sample.findAll({ raw: true });

    const points = [];
    for (const sample of samples) {
      if (!points.includes(sample.point)) {
        points.push(sample.point);
      }
    }

    points.sort();

    res.render("sample/chartPointSelection", { points });
  }

  static async chartBatchExport(req, res) {
    let points = req.body.pointsSelect;

    if (!Array.isArray(points)) {
      points = [points];
    }

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=graficos_de_conformidade.zip"
    );

    archive.pipe(res);

    const width = 800;
    const height = 600;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      plugins: {
        modern: [ChartDataLabels],
      },
    });

    for (const point of points) {
      const samples = await Sample.findAll({
        raw: true,
        where: { point: point, "data.conformity": { [Op.not]: null } },
      });

      if (samples.length === 0) {
        continue;
      }

      let accordingCount = 0;
      let notAccordingCount = 0;
      for (const sample of samples) {
        if (sample.data.conformity === "Conforme") {
          accordingCount += 1;
        } else {
          notAccordingCount += 1;
        }
      }
      const totalCount = samples.length;
      const accordingPercent = (accordingCount / totalCount) * 100;
      const notAccordingPercent = (notAccordingCount / totalCount) * 100;

      const configuration = {
        type: "bar",
        data: {
          labels: ["Conforme (%)", "Não conforme (%)"],
          datasets: [
            {
              label: "Conformidade",
              data: [
                accordingPercent.toFixed(2),
                notAccordingPercent.toFixed(2),
              ],
              backgroundColor: [
                "rgba(75, 192, 192, 0.7)",
                "rgba(255, 99, 132, 0.7)",
              ],
              borderColor: ["rgba(75, 192, 192, 1)", "rgba(255, 99, 132, 1)"],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "top" },
            title: {
              display: function (context) {
                if (!context.dataset) {
                  return false;
                }

                return context.dataset.data[context.dataIndex] > 0;
              },
              text: `Gráfico de conformidade - ${point}`,
            },
            datalabels: {
              anchor: "end",
              align: "top",
              color: "#444",
              font: {
                weight: "bold",
              },
              formatter: function (value, context) {
                return value > 0 ? `${value} %` : null;
              },
            },
          },
        },
      };
      const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

      archive.append(imageBuffer, {
        name: `grafico_conformidade_${point}.png`,
      });
    }
    await archive.finalize();
  }
};
