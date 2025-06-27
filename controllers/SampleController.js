const Sample = require("../models/Sample");

const fs = require("fs");
const csv = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const QuickChart = require("quickchart-js");
const archiver = require("archiver");
const { default: axios } = require("axios");

module.exports = class SampleController {
  static index(req, res) {
    res.render("sample/index");
  }

  static async listSamples(req, res) {
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

  static async deleteSample(req, res) {
    await Sample.destroy({ where: { id: req.body.id } });

    res.redirect("/sample/list");
  }

  static async editSampleGet(req, res) {
    const sample = await Sample.findOne({
      raw: true,
      where: { id: req.params.id },
    });

    res.render("sample/edit", { sample });
  }

  static async editSamplePost(req, res) {
    const id = req.body.id;

    const sample = await Sample.findOne({ raw: true, where: { id: id } });

    const variableData = {};

    for (const key in req.body) {
      variableData[key] = req.body[key];
    }

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
              data: {
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

  static async shOptions(req, res) {
    try {
      const dbRows = await Sample.findAll({ raw: true });

      const points = [];
      const parameters = [];
      for (const dbRow of dbRows) {
        if (!points.includes(dbRow.point)) {
          points.push(dbRow.point);
        }

        for (const [key, value] of Object.entries(dbRow.data)) {
          if (!parameters.includes(key)) {
            parameters.push(key);
          }
        }
        points.sort();
        parameters.sort();
      }

      res.render("sample/shOptions", { points, parameters });
    } catch (error) {
      console.log(error);
    }
  }

  static async _generateChartBuffer(point, parameter, initialDate, finalDate) {
    const samples = await Sample.findAll({
      raw: true,
      where: {
        point: point,
        date: { [Op.between]: [initialDate, finalDate] },
      },
      order: [["date", "ASC"]],
    });

    let chartData = [];
    for (const sample of Object.entries(samples)) {
      if (sample[1].data && sample[1].data[parameter]) {
        const parameterValue = parseFloat(
          sample[1].data[parameter].value.replace(",", ".")
        );

        chartData.push({
          x: sample[1].date,
          y: parameterValue,
        });
      }
    }

    const ironLimit = 0.3;

    const configuration = {
      type: "scatter",
      data: {
        datasets: [
          {
            label: `${parameter}`,
            data: chartData,
            backgroundColor: "rgba(0, 123, 255, 1)",
            borderColor: "rgba(0, 123, 255, 1)",
          },
          {
            type: "line",
            label:
              "Valor máximo permitido (CONAMA 357/05 - Classe II - Água Superficial - Água Doce)",
            data: [
              { x: initialDate, y: ironLimit },
              { x: finalDate, y: ironLimit },
            ],
            borderColor: "red",
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `Série histórica do ${parameter} para o ${point}`,
            font: { size: 18 },
          },
          legend: {
            position: "bottom",
          },
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "month",
              displayFormats: {
                month: "MMM/yyyy",
              },
            },
            title: {
              display: false,
            },
          },
          y: {
            type: "logarithmic",
            title: {
              display: true,
              text: `${parameter}`,
            },
          },
        },
      },
    };
    const chart = new QuickChart();
    chart.setConfig(configuration);
    chart.setWidth(800);
    chart.setHeight(600);
    chart.setBackgroundColor("white");
    chart.setVersion("3");

    const url = chart.getUrl();
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return response.data;
  }

  static async shPoint(req, res) {
    const point = req.query.point;
    const parameter = req.query.parameter;
    const initialDate = req.query.initialDate;
    const finalDate = req.query.finalDate;

    const imageBuffer = await SampleController._generateChartBuffer(
      point,
      parameter,
      initialDate,
      finalDate
    );

    res.setHeader("Content-Type", "image/png");
    res.send(imageBuffer);
  }

  static async shBulk(req, res) {
    let points = req.query.points;
    const parameter = req.query.parameter;
    const initialDate = req.query.initialDate;
    const finalDate = req.query.finalDate;

    if (!Array.isArray(points)) {
      points = [points];
    }

    const zipFileName = `graficos.zip`;
    res.attachment(zipFileName);

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });
    archive.on("error", (error) => {
      throw error;
    });
    archive.pipe(res);

    for (const point of points) {
      const imageBuffer = await SampleController._generateChartBuffer(
        point,
        parameter,
        initialDate,
        finalDate
      );

      const fileName = `grafico_${point}.png`;

      archive.append(imageBuffer, { name: fileName });
    }
    await archive.finalize();
  }
};
