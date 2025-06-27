const Parameter = require("../models/Parameter");

const { Op } = require("sequelize");

module.exports = class ParameterController {
  static createParameterGet(req, res) {
    res.render("parameter/create");
  }

  static async createParameterPost(req, res) {
    const name = req.body.name;
    const minValue = req.body.minValue;
    const maxValue = req.body.maxValue;
    const unit = req.body.unit;

    const parameters = await Parameter.findAll({ raw: true });
    for (const parameter of parameters) {
      if (name === parameter.name) {
        req.flash("message", "Parâmetro já cadastrado!");
        res.redirect("/parameter/create");
        return;
      }
    }

    const parameterData = {
      name: name,
      minValue: minValue.replace(",", "."),
      maxValue: maxValue.replace(",", "."),
      unit: unit,
    };

    await Parameter.create(parameterData);

    res.redirect("/parameter/list");
  }

  static async listParameters(req, res) {
    const search = req.query.search;

    let queryOptions = {
      where: {
        ...(search && {
          name: {
            [Op.like]: `%${search}%`,
          },
        }),
      },
      raw: true,
    };

    const parameters = await Parameter.findAll(queryOptions);

    res.render("parameter/list", { parameters });
  }

  static async editParameterGet(req, res) {
    const id = req.params.id;

    const parameter = await Parameter.findOne({ raw: true, where: { id: id } });

    res.render("parameter/edit", { parameter });
  }

  static async editParameterPost(req, res) {
    const id = req.params.id;
    const name = req.body.name;
    const minValue = req.body.minValue;
    const maxValue = req.body.maxValue;
    const unit = req.body.unit;

    // Verificando se o parâmetro editado existe
    const parameters = await Parameter.findAll({ raw: true });
    let count = 0;
    for (const parameterFor of parameters) {
      if (parameterFor.name === name) {
        count += 1;
      }
    }
    const parameter = await Parameter.findOne({ raw: true, where: { id: id } });
    if (count === 1 && name !== parameter.name) {
      req.flash("message", "Parâmetro já cadastrado!");
      res.redirect(`/parameter/edit/${id}`);
      return;
    }
    //

    const parameterData = {
      name: name,
      minValue: minValue.replace(",", "."),
      maxValue: maxValue.replace(",", "."),
      unit: unit,
    };

    await Parameter.update(parameterData, { where: { id: id } });

    res.redirect("/parameter/list");
  }

  static async deleteParameter(req, res) {
    const id = req.body.id;

    await Parameter.destroy({ where: { id: id } });

    res.redirect("/parameter/list");
  }
};
