const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Capsule = require("./Capsule");
const User = require("./User");

const CapsuleContribution = sequelize.define(
  "CapsuleContribution",
  {
    capsule_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },

    content_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    media_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "capsule_contribution",
    timestamps: false,
    freezeTableName: true,
  }
);

// relații
Capsule.hasMany(CapsuleContribution, { foreignKey: "capsule_id", onDelete: "CASCADE" });
CapsuleContribution.belongsTo(Capsule, { foreignKey: "capsule_id" });

User.hasMany(CapsuleContribution, { foreignKey: "user_id", onDelete: "CASCADE" });
CapsuleContribution.belongsTo(User, { foreignKey: "user_id" });

module.exports = CapsuleContribution;
