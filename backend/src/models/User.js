const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,   // 👈 FĂRĂ unique aici!
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    bio: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "users",        // 👈 nu mai folosim [user] (cuvânt rezervat în SQL)
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["email"],
        name: "UQ_users_email", // 👈 INDEX UNIC corect pt. MSSQL
      },
    ],
  }
);

module.exports = User;
