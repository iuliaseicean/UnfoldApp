const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Post = require("./Post");

const PostLike = sequelize.define(
  "PostLike",
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
      onDelete: "NO ACTION", // SQL Server: avoid multiple cascade paths
      onUpdate: "CASCADE",
    },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "post_like",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["post_id", "user_id"], name: "UQ_post_like_post_user" },
    ],
  }
);

// relations
Post.hasMany(PostLike, { foreignKey: "post_id", onDelete: "CASCADE" });
PostLike.belongsTo(Post, { foreignKey: "post_id" });

User.hasMany(PostLike, { foreignKey: "user_id", onDelete: "NO ACTION" });
PostLike.belongsTo(User, { foreignKey: "user_id" });

module.exports = PostLike;
