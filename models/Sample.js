const { DataTypes } = require("sequelize");

const db = require("../db/conn");

const Sample = db.define("Sample", {
  importId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  point: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ph: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nh4: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

module.exports = Sample;
