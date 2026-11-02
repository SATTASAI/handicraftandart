import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "../src/styles.css";
import { ApplicantTable } from "../src/components/ApplicantTable";
const fixtures = [
  {
    id: "test-1",
    name: "นางสาวครูตัวอย่าง ใจดี",
    email: "coach@example.test",
    school: "โรงเรียนตัวอย่าง",
    applicant_role: "coach",
    role: "participant",
    created_at: 1793601000,
  },
  {
    id: "test-2",
    name: "นายกรรมการ ทดสอบ",
    email: "judge@example.test",
    school: "โรงเรียนทดสอบ",
    applicant_role: "judge",
    role: "judge",
    created_at: 1793597400,
  },
  {
    id: "test-3",
    name: "ผู้ดูแลบัญชีเดิม",
    email: "owner@example.test",
    school: "โรงเรียนตัวอย่าง",
    applicant_role: null,
    role: "admin",
    created_at: 1793511000,
  },
];
function Preview() {
  const [users, setUsers] = useState(fixtures);
  return (
    <main style={{ padding: "32px", maxWidth: "1200px", margin: "auto" }}>
      <h1>จัดการสิทธิ์และการแข่งขัน</h1>
      <p className="muted" style={{ margin: "12px 0 25px" }}>
        ข้อมูลจำลองสำหรับตรวจหน้าจอ · สิทธิ์ผู้ใช้งาน
      </p>
      <p className="helper">
        บทบาทที่สมัครแสดงตามข้อมูลผู้สมัคร ผู้ดูแลเป็นผู้กำหนดสิทธิ์ใช้งานจริง
      </p>
      <ApplicantTable
        users={users}
        onRoleChange={(id, role) =>
          setUsers(users.map((u) => (u.id === id ? { ...u, role } : u)))
        }
      />
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Preview />);
