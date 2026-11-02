import React from "react";
export const applicantRoleLabel = (role) =>
  ({ judge: "กรรมการ", coach: "ผู้ฝึกซ้อม" })[role] || "ไม่ระบุ (บัญชีเดิม)";
const signupDate = (value) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(Number(value) * 1000))
    : "ไม่ระบุ";
export function ApplicantTable({
  users,
  busy = false,
  onRoleChange,
  onApprove,
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>ชื่อ / อีเมล</th>
            <th>โรงเรียน</th>
            <th>สมัครเป็น</th>
            <th>วันที่สมัคร</th>
            <th>หลักฐาน / ผลตรวจบัญชี</th>
            <th>สิทธิ์ใช้งานจริง</th>
          </tr>
        </thead>
        <tbody>
          {users.length ? (
            users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </td>
                <td>{u.school}</td>
                <td>{applicantRoleLabel(u.applicant_role)}</td>
                <td>{signupDate(u.created_at)}</td>
                <td>
                  {u.identity_document_id ? (
                    <a
                      href={"/api/documents/" + u.identity_document_id}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ดูภาพบัตร (ส่วนตัว)
                    </a>
                  ) : (
                    "ยังไม่แนบหลักฐาน"
                  )}
                  <p>{u.approval_status}</p>
                  {u.approval_note && <p>{u.approval_note}</p>}
                  {u.role !== "admin" && onApprove && (
                    <div className="row-actions">
                      <button
                        className="btn"
                        disabled={busy || !u.identity_document_id}
                        onClick={() => onApprove(u.id, "approved", "")}
                      >
                        ยืนยันบัญชี
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          const note = prompt("เหตุผลที่ต้องแก้ไข");
                          if (note) onApprove(u.id, "rejected", note);
                        }}
                      >
                        ให้แก้ไข
                      </button>
                    </div>
                  )}
                </td>
                <td>
                  <select
                    aria-label={"สิทธิ์ของ " + u.name}
                    value={u.role}
                    disabled={busy}
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                  >
                    <option value="participant">ผู้เข้าร่วม</option>
                    <option value="judge">กรรมการ</option>
                    <option value="admin">ผู้ดูแล</option>
                  </select>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6}>ยังไม่มีผู้สมัคร</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
