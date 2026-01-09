// backend/src/models/CoCapsContribution.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

// IMPORTANT: aici folosim capsule_id ca FK către tabela capsulelor tale.
// Dacă la tine tabela se numește Capsule și ai model, îl poți importa și lega.
const CoCapsContribution = sequelize.define(
  "CoCapsContribution",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    capsule_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: "NO ACTION", // SQL Server safe
      onUpdate: "CASCADE",
    },

    media_url: { type: DataTypes.STRING, allowNull: false },
    caption: { type: DataTypes.TEXT, allowNull: true },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "co_caps_contribution",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      // 1 user poate contribui o singură dată per capsulă
      { unique: true, fields: ["capsule_id", "user_id"], name: "UQ_co_caps_capsule_user" },
    ],
  }
);

// relations
User.hasMany(CoCapsContribution, { foreignKey: "user_id", onDelete: "NO ACTION" });
CoCapsContribution.belongsTo(User, { foreignKey: "user_id" });

module.exports = CoCapsContribution;