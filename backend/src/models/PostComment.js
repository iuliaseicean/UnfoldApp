const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Post = require("./Post");

const PostComment = sequelize.define(
  "PostComment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    post_id: {
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

    content_text: { type: DataTypes.TEXT, allowNull: false },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "post_comment",
    timestamps: false,
    freezeTableName: true,
  }
);

// relations
Post.hasMany(PostComment, { foreignKey: "post_id", onDelete: "CASCADE" });
PostComment.belongsTo(Post, { foreignKey: "post_id" });

User.hasMany(PostComment, { foreignKey: "user_id", onDelete: "NO ACTION" });
PostComment.belongsTo(User, { foreignKey: "user_id" });

module.exports = PostComment;
