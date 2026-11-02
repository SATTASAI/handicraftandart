export default function CompetitionPolicy({ policy = {}, onChange }) {
  const set = (key, value) => onChange({ ...policy, [key]: value });
  return (
    <fieldset className="policy-editor">
      <legend>คุณสมบัติและการตัดสิน</legend>
      <label>
        คะแนนเต็มก่อนแปลงเป็นร้อยละ{" "}
        <input
          type="number"
          min="1"
          max="1000"
          required
          value={policy.score_total || 100}
          onChange={(e) => set("score_total", Number(e.target.value))}
        />
      </label>
      <label>
        จำนวนกรรมการที่อนุญาต (คั่นด้วยจุลภาค){" "}
        <input
          required
          value={(policy.allowed_judge_counts || [1, 2, 3, 4, 5]).join(",")}
          onChange={(e) =>
            set("allowed_judge_counts", e.target.value.split(",").map(Number))
          }
        />
      </label>
      <label>
        ครูผู้ฝึกซ้อมอย่างน้อย{" "}
        <input
          type="number"
          min="1"
          max="100"
          value={policy.min_coaches || 1}
          onChange={(e) => set("min_coaches", Number(e.target.value))}
        />
      </label>
      <p className="helper">
        นับเฉพาะกรรมการที่ไม่มีส่วนได้เสียกับทีม
        ผู้จัดต้องตรวจคุณวุฒิตามเอกสารต้นฉบับ
      </p>
      {policy.age_min ? (
        <>
          <label>
            อายุอย่างน้อย{" "}
            <input
              required
              type="number"
              min="7"
              max="12"
              value={policy.age_min}
              onChange={(e) => set("age_min", Number(e.target.value))}
            />
          </label>
          <label>
            อายุไม่เกิน{" "}
            <input
              required
              type="number"
              min="7"
              max="12"
              value={policy.age_max}
              onChange={(e) => set("age_max", Number(e.target.value))}
            />
          </label>
        </>
      ) : (
        <div>
          ระดับชั้นที่รับสมัคร
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <label className="checkbox" key={n}>
              <input
                type="checkbox"
                checked={(
                  policy.allowed_grades || [
                    "ป.1",
                    "ป.2",
                    "ป.3",
                    "ป.4",
                    "ป.5",
                    "ป.6",
                  ]
                ).includes("ป." + n)}
                onChange={(e) => {
                  const grades = policy.allowed_grades || [
                    "ป.1",
                    "ป.2",
                    "ป.3",
                    "ป.4",
                    "ป.5",
                    "ป.6",
                  ];
                  set(
                    "allowed_grades",
                    e.target.checked
                      ? [...grades, "ป." + n].sort()
                      : grades.filter((x) => x !== "ป." + n),
                  );
                }}
              />
              ป.{n}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
