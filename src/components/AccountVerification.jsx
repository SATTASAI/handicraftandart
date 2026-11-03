export default function AccountVerification({ user }) {
  return (
    <section className="score-panel">
      <h1>บัญชีครู</h1>
      <h2>{user.name}</h2>
      <p>{user.school}</p>
      <p>{user.email}</p>
      {user.approval_status !== "approved" ? (
        <p role="alert">
          บัญชีนี้ถูกระงับหรืออยู่ในขั้นตอนเดิม กรุณาติดต่อผู้จัด{" "}
          {user.approval_note}
        </p>
      ) : (
        <>
          <p>
            ใช้บัญชีนี้ลงทะเบียนนักเรียนและรับงานกรรมการได้
            ไม่ต้องสร้างบัญชีเพิ่มหรืออัปโหลดบัตร
          </p>
          <p>
            ผู้จัดเป็นผู้มอบหมายรายการตัดสิน
            ครูจะไม่สามารถตัดสินรายการที่มีโรงเรียนตัวเองเข้าแข่งขัน
          </p>
        </>
      )}
    </section>
  );
}
