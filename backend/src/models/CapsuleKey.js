const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Capsule = require("./Capsule");

const CapsuleKey = sequelize.define(
  "CapsuleKey",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    capsule_id: { type: DataTypes.INTEGER, allowNull: false },

    value: { type: DataTypes.STRING(100), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: true },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  {
    tableName: "capsule_key",
    timestamps: false,
    freezeTableName: true
  }
);

Capsule.hasMany(CapsuleKey, { foreignKey: "capsule_id", onDelete: "CASCADE" });
CapsuleKey.belongsTo(Capsule, { foreignKey: "capsule_id" });

module.exports = CapsuleKey;
