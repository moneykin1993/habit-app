import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import StudentLogin from "./screens/StudentLogin";
import StudentReport from "./screens/StudentReport";
import ParentView from "./screens/ParentView";
import AdminDashboard from "./screens/AdminDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student-login" replace />} />
      <Route path="/student-login" element={<StudentLogin />} />
      <Route path="/student" element={<StudentReport />} />
      <Route path="/parent" element={<ParentView />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<div className="card">ページが見つかりません。</div>} />
    </Routes>
  );
}
