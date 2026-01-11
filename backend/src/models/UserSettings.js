// backend/src/models/UserSettings.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const UserSettings = sequelize.define(
  "UserSettings",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },

    is_private: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "user_settings",
    timestamps: true,
  }
);

module.exports = UserSettings;