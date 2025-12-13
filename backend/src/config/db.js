const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.MSSQL_DB,
  process.env.MSSQL_USER,
  process.env.MSSQL_PASS,
  {
    host: process.env.MSSQL_HOST,
    dialect: "mssql",
    logging: true,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: process.env.MSSQL_INSTANCE
      }
    }
  }
);

async function connectDB() {
  try { await sequelize.authenticate(); console.log("✅ SQL Server connected"); }
  catch (err) { console.error("❌ SQL Server connection error:", err.message); process.exit(1); }
}
module.exports = { sequelize, connectDB };
