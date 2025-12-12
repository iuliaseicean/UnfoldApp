const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CapsuleAccess = sequelize.define(
  "CapsuleAccess",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    capsule_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  {
    tableName: "capsule_access",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["capsule_id", "user_id"], name: "UQ_capsule_access_capsule_user" }
    ]
  }
);

module.exports = CapsuleAccess;
