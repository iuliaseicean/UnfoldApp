const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Capsule = sequelize.define("Capsule", {
  capsule_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  creator_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(150) },
  description: { type: DataTypes.TEXT },
  capsule_type: { type: DataTypes.STRING(10), defaultValue: "time" },
  open_at: { type: DataTypes.DATE },
  visibility_duration: { type: DataTypes.INTEGER },
  required_contributors: { type: DataTypes.INTEGER },
  key_code: { type: DataTypes.STRING(100) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: "capsule",
  timestamps: false,
  freezeTableName: true
});

User.hasMany(Capsule, { foreignKey: "creator_id" });
Capsule.belongsTo(User, { foreignKey: "creator_id" });

module.exports = Capsule;
