// backend/src/models/associations.js
const User = require("./User");
const UserSettings = require("./UserSettings");

// IMPORTANT:
// - as: "Settings" trebuie să fie EXACT același peste tot (include + where "$User.Settings.is_private$")
// - constraints/onUpdate ca să fie consistent în SQL Server

if (!User.associations?.Settings) {
  User.hasOne(UserSettings, {
    foreignKey: "user_id",
    as: "Settings",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    constraints: true,
  });
}

if (!UserSettings.associations?.User) {
  UserSettings.belongsTo(User, {
    foreignKey: "user_id",
    as: "User",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    constraints: true,
  });
}

module.exports = { User, UserSettings };