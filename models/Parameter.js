const { DataTypes } = require("sequelize");

const db = require("../db/conn");

const Parameter = db.define("Parameter", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  minValue: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  maxValue: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Parameter;
