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
      references: { model: "capsule", key: "capsule_id" },
      onDelete: "CASCADE",     // ok: capsule -> contributions
      onUpdate: "CASCADE",
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: "users", key: "id" },
      onDelete: "NO ACTION",   // IMPORTANT pentru SQL Server (evită multiple cascade paths)
      onUpdate: "CASCADE",
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

// Relații
Capsule.hasMany(CapsuleContribution, {
  foreignKey: "capsule_id",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
CapsuleContribution.belongsTo(Capsule, {
  foreignKey: "capsule_id",
});

User.hasMany(CapsuleContribution, {
  foreignKey: "user_id",
  onDelete: "NO ACTION", // IMPORTANT
  onUpdate: "CASCADE",
});
CapsuleContribution.belongsTo(User, {
  foreignKey: "user_id",
});

module.exports = CapsuleContribution;