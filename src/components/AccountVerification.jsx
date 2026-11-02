import { api } from "../api";
import IdentityUpload from "./IdentityUpload";
export default function AccountVerification({ user, onUser }) {
  return (
    <section className="score-panel">
      <h1>สถานะบัญชีโรงเรียน / กรรมการ</h1>
      <p>
        ชื่อ {user.name} · {user.school}
      </p>
      <p>
        สถานะ:{" "}
        {
          {
            approved: "แอดมินยืนยันแล้ว",
            pending: "รอแอดมินตรวจสอบ",
            rejected: "ต้องแก้ไขหลักฐาน",
          }[user.approval_status]
        }
      </p>
      {user.approval_note && <p>{user.approval_note}</p>}
      <IdentityUpload
        purpose="account"
        label="ภาพถ่ายบัตรประชาชนของผู้สมัครบัญชี"
        value={user.identity_document_id}
        onChange={async () => onUser((await api("/auth/me")).user)}
      />
      <p className="helper">
        บัญชีใหม่ต้องผ่านการตรวจสอบก่อนลงทะเบียนหรือทำหน้าที่กรรมการ
        การเปลี่ยนหลักฐานจะส่งให้แอดมินตรวจใหม่
      </p>
      <button
        className="btn"
        onClick={async () => onUser((await api("/auth/me")).user)}
      >
        ตรวจสถานะล่าสุด
      </button>
    </section>
  );
}
