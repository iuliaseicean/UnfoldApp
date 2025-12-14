const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Capsule = require("./Capsule");

const CapsuleKey = sequelize.define(
  "CapsuleKey",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    capsule_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // DB-ul tău are (din ce ai arătat) NVARCHAR(100)
    // bcrypt hash (~60 chars) încape.
    value: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "capsule_key",
    timestamps: false,
    freezeTableName: true,

    // IMPORTANT: NU punem indexes aici
    // pentru că fără control pe DB/SSMS poate genera conflicte.
  }
);

// Asocieri (fără onDelete ca să evităm probleme MSSQL / multiple cascade paths)
Capsule.hasMany(CapsuleKey, { foreignKey: "capsule_id" });
CapsuleKey.belongsTo(Capsule, { foreignKey: "capsule_id" });

module.exports = CapsuleKey;