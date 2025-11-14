const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Post = sequelize.define("Post", {
  post_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  content_text: { type: DataTypes.TEXT },
  media_url: { type: DataTypes.STRING(255) },
  visibility: { type: DataTypes.STRING(20), defaultValue: "public" },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: "post",
  timestamps: false,
  freezeTableName: true
});

User.hasMany(Post, { foreignKey: "user_id" });
Post.belongsTo(User, { foreignKey: "user_id" });

module.exports = Post;
