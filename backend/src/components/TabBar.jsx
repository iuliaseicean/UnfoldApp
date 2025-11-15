import React from "react";
import "./TabBar.css";

export default function TabBar() {
  return (
    <div className="tabbar">
      <button className="tab-item">
        <span className="material-icons">home</span>
        <p>Home</p>
      </button>

      <button className="tab-item">
        <span className="material-icons">search</span>
        <p>Search</p>
      </button>

      <button className="tab-item create-btn">
        <span className="material-icons">add_circle</span>
      </button>

      <button className="tab-item">
        <span className="material-icons">person</span>
        <p>Profile</p>
      </button>
    </div>
  );
}
