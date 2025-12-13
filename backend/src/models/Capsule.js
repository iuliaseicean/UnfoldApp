const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Capsule = sequelize.define(
  "Capsule",
  {
    capsule_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    creator_id: { type: DataTypes.INTEGER, allowNull: false },

    title: { type: DataTypes.STRING(150), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },

    // "time" | "co" | "key"
    capsule_type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "time",
      validate: { isIn: [["time", "co", "key"]] }
    },

    // status: locked/open/archived
    status: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "locked",
      validate: { isIn: [["locked", "open", "archived"]] }
    },

    // TIME: deschidere la o anumită dată
    open_at: { type: DataTypes.DATE, allowNull: true },

    // cât timp e vizibilă după ce se deschide (în ore)
    visibility_duration: { type: DataTypes.INTEGER, allowNull: true }, // hours

    // CO: număr minim contributori unici necesari
    required_contributors: { type: DataTypes.INTEGER, allowNull: true },

    // când devine OPEN / ARCHIVED
    opened_at: { type: DataTypes.DATE, allowNull: true },
    archived_at: { type: DataTypes.DATE, allowNull: true },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  {
    tableName: "capsule",
    timestamps: false,
    freezeTableName: true
  }
);

// relații
User.hasMany(Capsule, { foreignKey: "creator_id", onDelete: "CASCADE" });
Capsule.belongsTo(User, { foreignKey: "creator_id" });

module.exports = Capsule;
